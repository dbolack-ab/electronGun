const remote = require('electron').remote;
const ipc = require('electron').ipcRenderer
const mg = require('mailgun-es6');

var mailgun;
var mailingList;
var listObject;
var members = [];

let headerButtons = [ "btn_sendemail", "btn_close", "btn_maximize", "btn_minimize", "btn_tray" ];

for ( var bLoop = 0; bLoop < headerButtons.length; bLoop++)
{
  document.getElementById(headerButtons[ bLoop ]).addEventListener("click", function(e) {
    let src = e.target;
    if( src.children.length === 0 ) { src = src.parentElement; }
    ipc.send(src.id,"");
   } );
}


ipc.on('loadList', function(event, arg) {
  mailgun = new mg( { privateApi: arg.electronGunSettings.apikey, publicApi: arg.electronGunSettings.pubkey, domainName: 'foo.com' } );
  // Build a function to rebuild the header here.
  let table = document.getElementById('userList').getElementsByTagName('tbody')[0];
  for( var rowLoop = table.children.length-1; rowLoop >= 0;  rowLoop-- )
  {
    table.children[ rowLoop ].remove();
  }

  mailingList = arg.address;
  console.log(arg);
  console.log( "Setting list to " + mailingList );
  let membersStored = 0;
  if ( arg.hasOwnProperty('membersList') ) {
    console.log("List has " + arg.membersList.length + " subscribers stored in db.");
    renderUserList( arg.membersList );
    membersStored = arg.membersList.length;
  }
  if ( arg.hasOwnProperty('members_count') ) {
    console.log("List has " + arg.members_count + " subscribers." );
    if ( arg.members_count != membersStored ) { alert("Member list out of sync."); }
  }
})

function closeList() {
  document.getElementById('resyncButton').disabled = false;
  ipc.send('closeListWindow', {});
}

function renderUserList( membersList ) {

  let tBody = document.getElementById('userList').getElementsByTagName('tbody')[0];

  membersList.forEach( function(entry) {
    let newTR = document.createElement('tr');
    let newTD = document.createElement('td');
    newTD.innerHTML = entry.address;
    newTR.appendChild(newTD);
    tBody.appendChild(newTR);
  });
}

function pagesSuccess ( oRes ) {
  let o = oRes.res;
  // Make sure we have a paging object
  if ( o.hasOwnProperty( 'paging' ) )
  {
    // Make sure we have a next
    if ( o.paging.hasOwnProperty ( 'next' ) ) {
      let urlArray = o.paging.next.split('/')
      if( o.hasOwnProperty( 'items') )
      {
        if( o.items.length > 0 ) {
          oRes.membersList = oRes.membersList.concat( o.items );
          let p = mailgun.getMailListsPages(urlArray[5],urlArray[7], 100)
          p.then(function( success ) { pagesSuccess( { res: success, membersList: oRes.membersList })}, function(err){ console.log(err);});
        } else {
          // We're done grabbing the list!
          ipc.send( 'storeListMembers', { address: urlArray[5], members: oRes.membersList } );
          document.getElementById('resyncButton').disabled = false;
          renderUserList( oRes.membersList );
        }
      }
    }
  }
}

function reSync() {
  console.log("Resync called");
  document.getElementById('resyncButton').disabled = true;
  document.getElementById('userList').getElementsByTagName('tbody')[0].innerHTML = '';
  let p = mailgun.getMailListsPages( mailingList, '', 100)
  p.then(function( success ) { pagesSuccess( { res: success, membersList: [] })}, function(err){ console.log(err);});
}
