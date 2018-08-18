const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer

document.addEventListener('DOMContentLoaded', function () {
  // Semi-Lazy, usually headerbutton hooks. These ipc.send() to the index.js as they are typically things needing to either
  // push actions to other windows or influence things on the main process.
  // Uses the button/element id as the ipc action.

  let headerButtons = [ "btn_closeSend", "btn_previewMail", "btn_sendTheMail" ];

  for ( var bLoop = 0; bLoop < headerButtons.length; bLoop++)
  {
    document.getElementById(headerButtons[ bLoop ]).addEventListener("click", function( triggerEvent ) {
      // Check and see if the button or the inner node registered.
      // If it is an inner child, use the parent
      let src = triggerEvent.target;
      if( src.children.length === 0 ) { src = src.parentElement; }
      ipc.send(src.id, 'sendEmail' );
     } );
  }
});

// IPC Handlers

ipc.on('setupSendMail', function( event, arg) {
  document.getElementById('editMailArea').value = '';
  document.getElementById('listName').innerHTML = arg.listName;
});
