const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var electronGunSettings;

document.addEventListener('DOMContentLoaded', function () {
  // Semi-Lazy, usually headerbutton hooks. These ipc.send() to the index.js as they are typically things needing to either
  // push actions to other windows or influence things on the main process.
  // Uses the button/element id as the ipc action.

  let headerButtons = [ "btn_config", "btn_syncmaillists" ];

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


// Builds the table body of mailing lists.
function displayMailingLists( mailingLists ) {
  // Find the Table element.
  let table = document.getElementById('lists');
  // Remove all but the first row.
  for( var rowLoop = table.children.length-1; rowLoop > 0;  rowLoop-- )
  {
    table.children[ rowLoop ].remove();
  }
  // Iterate through the list of mailing lists and create a new row for each list.
  mailingLists.forEach( function ( mailingList ) {
    // Create all of the raw nodes for row.
    let newTR = document.createElement('tr');
    let newTDMailingListAddress = document.createElement('td');
    let newTDMailingListName = document.createElement('td');
    let newDivMailingListAddress = document.createElement('div');
    let newDivMailingListName = document.createElement('div');

    // Populate the DOM
    newTR.appendChild(newTDMailingListName);
    newTR.appendChild(newTDMailingListAddress);
    newTDMailingListAddress.appendChild( newDivMailingListAddress );
    newTDMailingListName.appendChild( newDivMailingListName );

    // Populate the address div and set the event listener
    newDivMailingListAddress.className = 'clickableAddress';
    newDivMailingListAddress.addEventListener("click", function (event) { editMailingListButton( mailingList.address ); } );
    newDivMailingListAddress.innerHTML = mailingList.address;

    // Populate the list name
    newDivMailingListName.innerHTML = mailingList.name;

    // Add the row to the table
    table.appendChild( newTR );
  } );
}

// Take the results of a completed full query and tell the main process to update.
function processMailingListQueryResults( mailingListsQueryResult ) {
  displayMailingLists( mailingListsQueryResult.items );
  ipc.send('syncedMailingLists', mailingListsQueryResult.items );
}

function queryMailingLists() {
  // Make sure we have the API values.
  if( electronGunSettings.hasOwnProperty('apikey') && electronGunSettings.hasOwnProperty('pubkey') ) {
    // Create the new mailgun instance
    let mailgun = new mg({ privateApi: electronGunSettings.apikey, publicApi: electronGunSettings.pubkey, domainName: electronGunSettings.activeDomain } );
    // Get the Promise
    let listPromise = mailgun.getMailLists();
    // On complete, send it to the processMailingListQueryResults function
    listPromise.then( processMailingListQueryResults, function(err) { console.log(err); } )
  }
}

// This is fired when the resync is fired.
ipc.on('passedElectronGunSettings', function(event, arg) {
  // Store pased along global settings
  electronGunSettings = arg;
  // Set the footer - if it's foo.com, leave it unset. Oddly, concating this on the initial line results in nothing showing...
  document.getElementById('mainFooter').innerHTML = "Active Domain: ";
  document.getElementById('mainFooter').innerHTML += ( electronGunSettings.activeDomain === 'foo.com') ? '<none>' : electronGunSettings.activeDomain;
  // Run the resync
  queryMailingLists();
});

// Event listener to trigger rendering the mailing list table.
ipc.on('loadedLists', function(event, arg) {
  displayMailingLists( arg );
});

// Event Handler for when a mailing list is selected from the list.
// Triggers opening the list editing window.
function editMailingListButton( address )
{
  ipc.send('launchEdit', { address: address });
}
