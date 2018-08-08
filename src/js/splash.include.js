// Header Menu Button Listen Events

const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer

// Events the config window listens For
ipc.on('updateLoading', function (event, arg) {
    // Bundle up the form values as the settings object and send it back.
    console.log('Updating:' + arg)
    document.getElementById('loadingDiv').innerHTML = arg;
});

console.log('Firing loadApp');
ipc.send( 'loadApp','gogogogo');
