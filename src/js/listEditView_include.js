const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var mailgun;
var electronGunSettings;
var members = [];


document.addEventListener('DOMContentLoaded', function () {
  // Semi-Lazy, usually headerbutton hooks. These ipc.send() to the index.js as they are typically things needing to either
  // push actions to other windows or influence things on the main process.
  // Uses the button/element id as the ipc action.

  let headerButtons = [ "btn_sendMailWindow", "btn_GenericCloseWindow", "btn_adduser", "btn_deluser" ];

  for ( var bLoop = 0; bLoop < headerButtons.length; bLoop++)
  {
    document.getElementById(headerButtons[ bLoop ]).addEventListener("click", function( triggerEvent ) {
      // Check and see if the button or the inner node registered.
      // If it is an inner child, use the parent
      let src = triggerEvent.target;
      if( src.children.length === 0 ) { src = src.parentElement; }
      ipc.send(src.id, 'listEditWindow' );
     } );
  }

  // Locally handled Buttons

  document.getElementById( "btn_syncmaillistusers" ).addEventListener("click", reSync );
  document.getElementById( "searchFilter" ).addEventListener("keyup", filterEmails );

});

// IPC Handlers

// This function handles the initialization/updating of our settings global and triggers a rerender of the userlist table.
ipc.on('loadList', function(event, arg) {
  let membersStored = 0;
  let lastSynced;

  electronGunSettings = arg.electronGunSettings;
  document.getElementById('btn_syncmaillistusers').disabled = false;
  // Setup the mailgun object. Currently using a placeholder domain because it doesn't seem to actually matter to the API so long as one is there.
  mailgun = new mg({ privateApi: electronGunSettings.apikey, publicApi: electronGunSettings.pubkey, domainName: 'foo.com' } );

  // Clear out the table data rows.
  let table = document.getElementById('userList').getElementsByTagName('tbody')[0];
  for( var rowLoop = table.children.length-1; rowLoop >= 0;  rowLoop-- )
  {
    table.children[ rowLoop ].remove();
  }

  // Check for members. This list might not have been initialised.
  if ( arg.hasOwnProperty('membersList') ) {
    console.log("List has " + arg.membersList.length + " subscribers stored in db.");
    renderUserList( arg.membersList );
    membersStored = arg.membersList.length;
  }

  // Check for list sync issues. Not the most reliable check as written.
  if ( arg.hasOwnProperty('members_count') ) {
    console.log("List has " + arg.members_count + " subscribers." );
    if ( arg.members_count != membersStored ) { alert("Member list out of sync."); }
  }

  // Update the footer with some basic stats.
  document.getElementById('listname').innerHTML = electronGunSettings.mailingList + ' - ' + arg.members_count + ' members - Last Synced: ' +
    ( arg.hasOwnProperty('lastSynced') ? arg.lastSynced: 'unsynced' );
})

// Helpers

function filterEmails() {
  let filterString = document.getElementById('searchFilter').value;
  // Run through the list and hide rows that don't match.
  let table = document.getElementById('userList').getElementsByTagName('tbody')[0];
  for( var rowLoop = table.children.length-1; rowLoop >= 0;  rowLoop-- )
  {
    if( !indexOfi( table.children[ rowLoop ].children[0].innerHTML, filterString ) )
    {
      table.children[ rowLoop ].style.display = 'none';
    } else {
      table.children[ rowLoop ].style.display = 'table';
    }
  }
}

// Helper to make this less ugly.
function indexOfi( sourceStr, matchStr )
{
  return( sourceStr.toLowerCase().indexOf( matchStr.toLowerCase() ) != -1 );
}

// Populate the table with rows of mailing list users.
function renderUserList( membersList ) {

  // Grab the body
  let tBody = document.getElementById('userList').getElementsByTagName('tbody')[0];

  // Loop through the membership list and create a new row for each user.
  // This will need to be enhanced once the new fields are
  membersList.forEach( function(entry) {
    let newTR = document.createElement('tr');
    let newTD = document.createElement('td');
    let newNameTD = document.createElement('td');
    newTD.innerHTML = entry.address;
    newNameTD.innerHTML = entry.name;
    newTR.appendChild(newTD);
    newTR.appendChild(newNameTD);
    tBody.appendChild(newTR);
  });
}

// Runs with the promise reults from the resync.
function pagesSuccess ( pagesResult, listAddress ) {
  // Grab the date so we know when the last sync happened.
  let lastSyncedAsString = new Date().toLocaleString("en-us");
  // Let the main process know it needs to store the updated list of members in the DB along with the new sync date.
  ipc.send( 'storeListMembers', { address: listAddress, members: pagesResult.items, lastSynced: lastSyncedAsString } );
  // Reenable the sync button
  document.getElementById('btn_syncmaillistusers').disabled = false;
  // Draw the new list.
  renderUserList( pagesResult.items );
}

// Button Action function for the resync process.
function reSync() {
  // Disable the sync button. Right now this is our only indicator of activity.
  document.getElementById('btn_syncmaillistusers').disabled = true;
  // Clear out the existing rows.
  document.getElementById('userList').getElementsByTagName('tbody')[0].innerHTML = '';
  // Fire off our query and send the results to pageSuccess.
  let p = mailgun.getMailListsMembers( electronGunSettings.mailingList )
  p.then(function( success ) { pagesSuccess( success, electronGunSettings.mailingList ); }, function(err){ console.log("ERROR:" + JSON.stringify(err));});
}
