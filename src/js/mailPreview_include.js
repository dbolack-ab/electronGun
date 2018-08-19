const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer

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
      ipc.send(src.id, 'mailPreview' );
     } );
  }
});


// IPC Handlers

// Load the HTML into the preview DOM object.
ipc.on('mailPreview', function(event, arg) {
  document.getElementById('previewArea').innerHTML = arg.preview;
});
