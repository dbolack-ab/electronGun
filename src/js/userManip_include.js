const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var electronGunSettings;

document.addEventListener('DOMContentLoaded', function () {
  // Semi-Lazy, usually headerbutton hooks. These ipc.send() to the index.js as they are typically things needing to either
  // push actions to other windows or influence things on the main process.
  // Uses the button/element id as the ipc action.
  let headerButtons = [ "btn_closeUserManipWindow", "btn_adduser", "btn_deluser" ];

  for ( var bLoop = 0; bLoop < headerButtons.length; bLoop++)
  {
    document.getElementById( headerButtons[ bLoop ]).addEventListener("click", function( triggerEvent ) {
      // Check and see if the button or the inner node registered.
      // If it is an inner child, use the parent
      let src = triggerEvent.target;
      if( src.children.length === 0 ) { src = src.parentElement; }
      ipc.send(src.id, 'userManipulation' );
     } );
  }
});

// IPC Handlers

ipc.on('prepareAction', function( event, arg ) {
  // We'll want some of these config values at various points.
  electronGunSettings = arg.settings;
  // Flip mode.
  if( arg.action === 'addUsers' )
  {
    document.getElementById('action').innerHTML = 'Add Addresses';
    document.getElementById('formAction').value = 'add';
  } else {
    document.getElementById('action').innerHTML = 'Remove Addresses';
    document.getElementById('formAction').value = 'del';
  }
});

// Helpers

// This function tells the main process to update the database to reflect the user being added or removed.
// Single user.
function updatedAnAddress( resultMessage, newUserObject, addUser ) {
  if( addUser ) {
    ipc.send('storeListMembers', { address: electronGunSettings.mailingList, newmember: newUserObject } );
  } else {
    ipc.send('storeListMembers', { address: electronGunSettings.mailingList, removemember: newUserObject } );
  }
}

// Reponse function to process the list of users from the textarea.
function processForm() {
  // Convert common delimiters into \n then punch that into an array
  let listofAddresses = document.getElementById('addresses').value.replace(',',"\n").replace(':',"\n").replace(' ', "\n").split("\n");
  // Clear the textarea
  document.getElementById('addresses').value = '';
  // Sanity Check for API Needs in order to talk to mailgun.
  if( electronGunSettings.hasOwnProperty('apikey') && electronGunSettings.hasOwnProperty('pubkey') ) {
    // Setup the mailgun object. Currently using a placeholder domain because it doesn't seem to actually matter to the API so long as one is there.
    let mailgun = new mg({ privateApi: electronGunSettings.apikey, publicApi: electronGunSettings.pubkey, domainName: 'foo.com' } );

    // Iterate through the area.
    listofAddresses.forEach( function ( newAddress ) {
      // Create a new user object for the address.
      // At this point, we aren't concerned with any of the other fields at this build.
      let newUserObject = {}
      newUserObject.name = '';
      newUserObject.address = newAddress;
      // Trap for empty addresses.
      if( newAddress.length > 0 ) {
        // Use the appropriate API call and pass the results and add/delete mode to the helper function.
        if ( document.getElementById('formAction').value === 'add' ) {
          let addPromise = mailgun.addMailListsMembers( electronGunSettings.mailingList, [ newUserObject ] );
          addPromise.then( function(succ) { updatedAnAddress( succ, newUserObject, true ); }, function(err) { console.log(err) })
        } else {
          let addPromise = mailgun.deleteMailListsMembers( electronGunSettings.mailingList, newAddress );
          addPromise.then( function(succ) { updatedAnAddress( succ, newUserObject, false ); }, function(err) { console.log(err) })
        }
      }
    } );
  }
}
