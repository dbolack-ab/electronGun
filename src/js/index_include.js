const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var electronGunSettings;

let headerButtons = [ "btn_config", "btn_sendemail", "btn_close", "btn_maximize", "btn_minimize", "btn_tray" ];

for ( var bLoop = 0; bLoop < headerButtons.length; bLoop++)
{
  console.log(headerButtons[ bLoop ]);
  document.getElementById(headerButtons[ bLoop ]).addEventListener("click", function(e) {
    let src = e.target;
    if( src.children.length === 0 ) { src = src.parentElement; }
    ipc.send(src.id,"");
   } );
}

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
  console.log("Got " + arg);
  displayMailingLists( arg );
});


function queryMailingListsButton()
{
  ipc.send('fetchElectronGunSettings', {} );
}

function editMailingListButton( address )
{
  console.log(address);
  ipc.send('launchEdit', { address: address });
}
