const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer

// Needs a lot more pretty.

// Handler for the update box.
ipc.on('updateLoading', function (event, arg) {
    // Bundle up the form values as the settings object and send it back.
    document.getElementById('loadingDiv').innerHTML = arg;
});

// Tell the main thread we're ready to load everything else up.
document.addEventListener('DOMContentLoaded', function () { ipc.send( 'loadApp','gogogogo'); } );
