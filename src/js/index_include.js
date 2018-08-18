const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var electronGunSettings;

document.addEventListener('DOMContentLoaded', function () {
  // Semi-Lazy, usually headerbutton hooks. These ipc.send() to the index.js as they are typically things needing to either
  // push actions to other windows or influence things on the main process.
  // Uses the button/element id as the ipc action.

  let headerButtons = [ "btn_config", "btn_syncmaillists", "btn_close", "btn_maximize", "btn_minimize", "btn_tray" ];

  for ( var bLoop = 0; bLoop < headerButtons.length; bLoop++)
  {
    document.getElementById(headerButtons[ bLoop ]).addEventListener("click", function( triggerEvent ) {
      // Check and see if the button or the inner node registered.
      // If it is an inner child, use the parent
      let src = triggerEvent.target;
      if( src.children.length === 0 ) { src = src.parentElement; }
      ipc.send(src.id, 'mainWindow' );
     } );
  }
});
function displayMailingLists( mailingLists ) {
  let table = document.getElementById('lists');
  for( var rowLoop = table.children.length-1; rowLoop > 0;  rowLoop-- )
  {
    table.children[ rowLoop ].remove();
  }
  mailingLists.forEach( function ( mailingList ) {
    let newTR = document.createElement('tr');
    let newTDMailingListAddress = document.createElement('td');
    let newTDMailingListName = document.createElement('td');
    let newDivMailingListAddress = document.createElement('div');
    let newDivMailingListName = document.createElement('div');

    newTR.appendChild(newTDMailingListName);
    newTR.appendChild(newTDMailingListAddress);
    newTDMailingListAddress.appendChild( newDivMailingListAddress );
    newTDMailingListName.appendChild( newDivMailingListName );

    newDivMailingListAddress.className = 'clickableAddress';
    newDivMailingListAddress.addEventListener("click", function (event) { editMailingListButton( mailingList.address ); } );
    newDivMailingListAddress.innerHTML = mailingList.address;
    newDivMailingListName.innerHTML = mailingList.name;
    table.appendChild( newTR );
  } );
}

function processMailingListQueryResults( mailingListsQueryResult ) {
  displayMailingLists( mailingListsQueryResult.items );
  ipc.send('syncedMailingLists', mailingListsQueryResult.items );
}

function queryMailingLists() {
  if( electronGunSettings.hasOwnProperty('apikey') && electronGunSettings.hasOwnProperty('pubkey') ) {
    let mailgun = new mg({ privateApi: electronGunSettings.apikey, publicApi: electronGunSettings.pubkey, domainName: 'foo.com' } );
    let listPromise = mailgun.getMailLists();
    listPromise.then( processMailingListQueryResults, function(err) { console.log(err); } )
  }
}

ipc.on('passedElectronGunSettings', function(event, arg) {
  electronGunSettings = arg;
  queryMailingLists();
});

ipc.on('loadedLists', function(event, arg) {
  displayMailingLists( arg );
});

function editMailingListButton( address )
{
  ipc.send('launchEdit', { address: address });
}
