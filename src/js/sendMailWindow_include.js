const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var electronGunSettings;

document.addEventListener('DOMContentLoaded', function () {
  // Semi-Lazy, usually headerbutton hooks. These ipc.send() to the index.js as they are typically things needing to either
  // push actions to other windows or influence things on the main process.
  // Uses the button/element id as the ipc action.

  let headerButtons = [ "btn_GenericCloseWindow" ];

  for ( var bLoop = 0; bLoop < headerButtons.length; bLoop++)
  {
    document.getElementById(headerButtons[ bLoop ]).addEventListener("click", function( triggerEvent ) {
      // Check and see if the button or the inner node registered.
      // If it is an inner child, use the parent
      let src = triggerEvent.target;
      if( src.children.length === 0 ) { src = src.parentElement; }
      ipc.send(src.id, 'sendMailWindow' );
     } );
  }

  // Locally handled buttons
  document.getElementById( "btn_sendEmail").addEventListener("click", function( triggerEvent ) {
    sendMessage();
  });
  document.getElementById( "btn_previewMail").addEventListener("click", function( triggerEvent ) {
    ipc.send( 'previewMail', { preview: document.getElementById("editMailArea").value } );
  });
});

// IPC Handlers

// Set up the page.
ipc.on('setupSendMail', function( event, arg) {
  // Clear the form fields from any previous runs.
  document.getElementById('editMailArea').value = '';
  document.getElementById('editMailSubject').value = '';
  // Copy the global application settings
  electronGunSettings = arg.electronGunSettings;
  // Set the list name in the footer.
  document.getElementById('listName').innerHTML = electronGunSettings.mailingList;
});

function sendMessage() {
    // We found one place where the domain here matters.
    let mailgun = new mg({ privateApi: electronGunSettings.apikey, publicApi: electronGunSettings.pubkey, domainName: electronGunSettings.activeDomain } );
    // Set up the mail transmission promise.
    let smPromise = mailgun.sendEmail( {
      to: [ electronGunSettings.mailingList ],
      from: electronGunSettings.mailingList,
      subject: document.getElementById('editMailSubject').value,
      text: document.getElementById('editMailArea').value,
      html: document.getElementById('editMailArea').value,
      domain: electronGunSettings.activeDomain
    } );
    // Crude, but usable until a design for update messages has been established.
  smPromise.then( function( success ) { console.log(success); alert ("Message sent!")}, function (error) { console.log( error ); } );
}
