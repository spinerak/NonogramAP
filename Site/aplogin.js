


// Function to get URL parameters
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};
window.getUrlParameter = getUrlParameter;

// Set values from URL parameters or use default values

let hostport = getUrlParameter('hostport');

if(!getUrlParameter('hostport')){
    hostport = getUrlParameter('hostname') + ":" + getUrlParameter('port');
    if(hostport == ":"){
        hostport = "";
    }
}

document.getElementById('hostport').value = hostport || localStorage.getItem("hostport");

document.getElementById('name').value = getUrlParameter('name') || localStorage.getItem("name");


// server stuff:
import {
    Client
} from "./archipelago.js";

document.getElementById('loginbutton').addEventListener('click', function() {
    startAP();
});

if(getUrlParameter('go') == 'LS'){
    startAP();
}

document.getElementById('name').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent the default form submission
        document.getElementById('loginbutton').click(); // Click the login button
    }
});

document.getElementById('offline5').addEventListener('click', function() {
    window.solo = true;
    startAP(5);
});

document.getElementById('offline10').addEventListener('click', function() {
    window.solo = true;
    startAP(10);
});

document.getElementById('offline15').addEventListener('click', function() {
    window.solo = true;
    startAP(15);
});


window.nclues = 0;

function startAP(size = 0){
    console.log("Starting AP login...");

    localStorage.setItem("hostport", document.getElementById("hostport").value);
    localStorage.setItem("name", document.getElementById("name").value);


    var client = null;
    var apstatus = "?";
    window.is_connected = false;

    
    // Timer label updater (updates every second)
    if (window.timerInterval) clearInterval(window.timerInterval);
    let timerStart = Date.now();
    function tickTimer() {
        const el = document.getElementById('timerLabel');
        if (!el) return;
        const totalSec = Math.floor((Date.now() - timerStart) / 1000);
        const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        el.textContent = mm + ':' + ss;
    }
    tickTimer();
    window.timerInterval = setInterval(tickTimer, 1000);


    function connectToServer(firsttime = true) {

        if(window.solo){
            function startWithPuzzle(puzzle_name){
                window.chosenPuzzle = puzzle_name;
                window.checked_locations = [];
                console.log("Chosen offline puzzle:", chosenPuzzle);
                window.startEverything(window.chosenPuzzle, []);
                document.getElementById("login-container").style.display = "none";
                document.getElementById("app").style.display = "flex";
                window.is_connected = true;

                document.getElementById('labelMode').textContent = "Solo";

                gotClue();
            }

            function parsePythonDict(python_dict) {
                // This is a very naive parser and assumes the input is well-formed
                const jsonString = python_dict;
                return JSON.parse(jsonString);
            }

            const python_dict = '{"C":[[["?","?","?"],["?","?","?"],["?","?","?","?"],["?","?","?"],["?","?"],["?","?","?"],["?","?","?","?","?"],["?","?","?"],["?"],["?","?","?"],["?","?","?","?"],["?","?"],["?","?","?"],["?","?","?","?"],["?","?","?","?"]],[["?","?","?","?"],["?","?"],["?","?","?"],["?","?","?","?"],["?"],["?","?","?","?"],["?","?","?","?"],["?","?","?"],["?","?","?","?","?"],["?","?","?","?"],["?","?","?"],["?","?"],["?","?","?"],["?","?"],["?","?","?"]]],"G":[[null,0],[[1,9,1,4],0],[[1,12,1,3],0],[[1,14,1,2],0],[[1,0,2,1],0],[[1,11,1,10],7],[[0,2,1,1],7],[[1,5,2,6],15],[[0,2,0,7],20],[[0,10,0,3],20],[[1,5,0,3],23],[[1,10,1,3],23],[[1,6,1,3],23],[[1,10,2,3],23],[[1,3,0,2],24],[[0,6,2,2],24],[[0,3,2,6],25],[[1,5,1,2],35],[[0,7,0,1],35],[[0,6,1,1],35],[[1,9,2,5],40],[[1,7,2,4],40],[[0,9,2,1],40],[[1,1,1,2],40],[[1,9,3,1],40],[[0,9,0,6],47],[[1,14,2,1],47],[[0,10,2,3],47],[[0,7,2,4],47],[[0,12,1,6],50],[[0,11,0,9],55],[[0,10,1,4],69],[[0,14,1,3],69],[[0,5,2,2],69],[[1,3,1,1],69],[[0,5,1,5],92],[[0,8,0,15],99],[[0,13,3,2],99],[[1,13,1,4],99],[[0,7,1,6],101],[[0,5,0,5],112],[[1,7,1,5],117],[[1,12,2,4],117],[[0,1,2,8],132],[[0,14,0,7],171],[[0,6,0,2],171],[[0,14,2,1],171],[[1,2,2,7],171],[[0,13,0,5],201],[[1,3,2,3],201],[[1,7,0,2],202],[[1,11,0,2],203],[[1,8,3,1],203],[[1,0,3,3],203],[[1,8,2,3],204],[[1,9,0,2],205],[[1,0,1,1],205],[[0,4,1,11],205],[[0,12,0,1],205],[[1,12,0,5],206],[[1,3,3,4],206],[[0,2,3,3],206],[[1,2,0,4],209],[[0,6,3,3],212],[[0,0,1,9],218],[[0,0,2,1],218],[[0,14,3,1],218],[[1,4,0,15],218],[[0,9,1,5],218],[[0,12,2,6],218],[[0,3,0,4],220],[[0,11,1,4],220],[[1,8,1,2],220],[[0,1,1,2],220],[[0,6,4,2],220],[[1,8,4,2],221],[[1,6,0,1],221],[[1,10,0,7],221],[[0,13,2,1],221],[[0,3,1,1],221],[[0,2,2,1],221],[[1,6,2,7],221],[[1,6,3,1],221],[[1,2,1,2],221],[[0,10,3,1],221],[[1,5,3,1],221],[[1,1,0,11],224],[[1,0,0,1],225]],"S":[[[-1,224,0],[-1,225,1],[1,188,0],[-1,219,0],[-1,220,1],[-1,102,0],[-1,193,1],[-1,110,0],[1,93,0],[-1,173,1],[1,56,0],[-1,51,0],[1,164,0],[1,172,0],[1,133,0]],[[-1,222,1],[1,223,1],[1,189,0],[1,194,1],[1,195,1],[1,103,0],[1,106,1],[1,107,1],[1,94,0],[1,67,0],[1,57,0],[1,84,0],[-1,87,1],[1,88,1],[1,89,1]],[[1,207,1],[1,208,1],[1,16,0],[1,197,0],[-1,209,1],[1,104,0],[1,196,0],[-1,111,0],[1,95,0],[1,68,0],[1,58,0],[1,85,0],[1,165,0],[1,155,0],[1,134,0]],[[-1,24,1],[-1,201,1],[1,17,0],[1,198,0],[-1,108,1],[1,105,0],[-1,109,1],[1,132,0],[1,96,0],[1,69,0],[-1,59,0],[1,86,0],[1,143,1],[1,144,1],[1,135,0]],[[1,213,0],[1,218,1],[1,18,0],[1,42,1],[1,43,1],[1,44,1],[1,45,1],[1,46,1],[1,47,1],[1,41,0],[1,55,1],[1,52,0],[1,91,1],[1,92,1],[1,90,0]],[[1,26,1],[1,21,1],[1,19,0],[-1,27,1],[1,28,1],[1,29,1],[-1,30,1],[1,8,1],[1,9,1],[1,10,1],[1,22,1],[1,23,1],[1,31,1],[-1,32,1],[1,33,1]],[[1,175,1],[-1,176,1],[1,20,0],[1,177,1],[1,178,1],[-1,70,0],[1,130,0],[1,100,0],[1,11,0],[1,174,0],[1,60,0],[1,53,0],[1,166,0],[-1,179,1],[1,136,0]],[[1,202,1],[1,118,0],[-1,190,0],[-1,113,1],[1,114,1],[1,71,0],[1,115,1],[1,101,0],[1,12,0],[-1,65,1],[1,61,0],[1,49,1],[1,48,0],[1,50,1],[-1,66,1]],[[1,214,0],[1,119,0],[1,191,0],[-1,192,0],[1,199,0],[1,72,0],[-1,131,0],[1,112,0],[1,13,0],[1,204,1],[-1,62,0],[1,54,0],[-1,167,0],[1,221,1],[1,137,0]],[[1,205,1],[1,120,0],[-1,123,1],[1,25,0],[1,36,1],[1,37,1],[1,124,1],[-1,125,1],[1,14,0],[1,38,1],[1,39,1],[1,40,1],[1,126,1],[-1,127,1],[1,128,1]],[[1,215,0],[1,121,0],[1,145,1],[1,34,0],[1,77,1],[1,73,0],[1,210,0],[-1,78,1],[1,15,0],[1,79,1],[1,63,0],[-1,80,1],[1,146,1],[1,147,1],[1,138,0]],[[1,203,1],[1,122,0],[-1,148,1],[1,35,0],[1,149,1],[1,1,1],[1,2,1],[1,3,1],[1,4,1],[1,5,1],[1,6,1],[1,7,1],[1,129,1],[-1,150,1],[-1,139,0]],[[1,206,1],[1,180,0],[1,183,1],[1,116,0],[1,200,0],[-1,74,0],[-1,211,0],[1,81,0],[1,97,0],[1,212,1],[-1,64,0],[1,151,1],[1,152,1],[1,153,1],[1,140,0]],[[-1,216,0],[1,181,0],[1,184,1],[1,117,0],[1,157,1],[1,75,0],[1,158,1],[1,82,0],[1,98,0],[-1,159,1],[1,160,1],[1,161,1],[1,162,1],[1,156,0],[-1,141,0]],[[1,217,0],[1,182,0],[1,185,1],[1,186,1],[1,187,1],[1,76,0],[1,168,1],[1,83,0],[1,99,0],[1,163,0],[-1,169,1],[1,170,1],[1,171,1],[-1,154,1],[1,142,0]]]}';
            console.log("Parsed offline puzzle python dict:", python_dict);
            const puzzle = parsePythonDict(python_dict);
            startWithPuzzle(puzzle);
            

            return;
        }
        
        document.getElementById('loginbutton').style.backgroundColor = "orange";

        const hostport = localStorage.getItem("hostport");
        const name = localStorage.getItem("name");
        const password = document.getElementById("password").value;

        console.log("Connecting to server...");
        client = new Client();
        client.items.on("itemsReceived", receiveditemsListener);
        client.socket.on("connected", connectedListener);
        client.socket.on("disconnected", disconnectedListener);
        client.room.on("roomUpdate", roomupdateListener);
        
        
        client
        .login(hostport, name, "Nonograhmm", {password: password})
            .then(() => {
                console.log("Connected to the server");
            })
            .catch((error) => {
                console.log("Failed to connect", error);
                let txt = (error && error.message) ? error.message : String(error);
                if (txt.includes("InvalidGame")){
                    const el = document.getElementById('error-label');
                    el.innerHTML = 'Game is incorrect. Playing an older version? Please move to <a href="https://nonogram-ap.netlify.app/" style="color:#ffffff;text-decoration:underline;">https://nonogram-ap.netlify.app/</a>';
                    return;
                }else{
                    txt += "\nCommon remedies: refresh room and check login info.";
                }
                document.getElementById('error-label').innerText = txt;
            });

    }

    const receiveditemsListener = (items, index) => {
        newItems(items, index);
    };

    var lastindex = 0;
    function newItems(items, index) {
        if (items && items.length) {
            if (index > lastindex) {
                alert("Something strange happened, you should have received more items already... Let's reconnect...");
                console.log("Expected index:", lastindex, "but got:", index, items);
            }
            var received_items = [];
            for (let i = lastindex - index; i < items.length; i++) {
                const item = items[i]; // Get the current item
                received_items.push([item.toString(), i, index]); // Add the item name to the 'items' array
            }
            openItems(received_items)
            lastindex = index + items.length;
        } else {
            console.log("No items received in this update...");
        }
    }

    function openItems(items) {
        let got_any = false;
        for (let i = 0; i < items.length; i++) {
            let item = items[i][0];
            if (item == "Nonograhmm clues") {
                gotClue();
                got_any = true;
            }
        }
        if (got_any) {
            const audio2 = new Audio('ding.wav');
            audio2.volume = .4;
            audio2.play();
        }
    }

    function gotClue(){
        console.log("Got clue ", window.nclues);
        window.nclues += 1;
        window.updateNextUnlockCount();
        window.checkAndUpdate();
    }

    
    function setCheckpoint(value){
        client.storage
            .prepare(`NNH${window.slot}`, 0)
            .max(value)         // Clamp value above 0.
            .commit();      // Commit operations to data storage.
    }
    window.setCheckpoint = setCheckpoint;

    const connectedListener = async (packet) => {
        document.getElementById("login-container").style.display = "none";
        document.getElementById("app").style.display = "flex";

        apstatus = "AP: Connected";
        console.log("Connected packet: ", packet);

        const puzzle = packet.slot_data.puzzle;
        const apworld = packet.slot_data.apworld_version;
        window.slot = packet.slot;
        console.log("AP World Version: ", apworld);
        if(apworld == "0.0.3"){
            alert("A new apworld is out. You will be redirected to an older version of the game that is compatible.");
            window.location.href = "google.nl";
            return;
        }

        document.getElementById('labelMode').textContent = "AP";
        
        window.checked_locations = packet.checked_locations || [];
        window.startEverything(puzzle);

        window.is_connected = true;

        let keys = [`NNH${window.slot}`];
        let results = (await client.storage.fetch(keys, true))
        console.log(results);
        window.solveUntil(results[`NNH${window.slot}`] || 0);

    };

    const disconnectedListener = (packet) => {
        window.is_connected = false;
        apstatus = "AP: Disconnected. Progress saved, please refresh.";
        alert("Disconnected from the server. Please refresh.");
        window.removeEventListener("beforeunload", window.beforeUnloadHandler);
        document.getElementById('nextUnlockCount').innerText = 'DISCONNECTED -> REFRESH';
    };

    const roomupdateListener = (packet) => {
        console.log(packet);
        if(packet.checked_locations){
            window.checked_locations += packet.checked_locations;
            console.log("Updated checked locations:", window.checked_locations);
        }
        window.updateNextUnlockCount();
    };

    function findAndDetermineChecks(total){
        console.log("Finding and determining checks for total:", total);
        sendCheck(67 + total);
        window.checked_locations.push(67 + total);
        window.updateNextUnlockCount();
    }
    window.findAndDetermineChecks = findAndDetermineChecks;

    function sendCheck(key){
        if(window.is_connected){
            if(window.solo){
                console.log("Solo mode, pretending to check ", key);
                gotClue();
                return;
            }
            client.check(parseInt(key));
            console.log("Sent check for ", key);
        }
    }
    function sendGoal(){
        if(window.is_connected){
            //stop timer window.timerInterval
            clearInterval(window.timerInterval);
            if(window.solo){
                return;
            }
            client.goal();
            window.removeEventListener("beforeunload", window.beforeUnloadHandler);
        }
    }

    window.sendCheck = sendCheck;
    window.sendGoal = sendGoal;

    console.log("0.1.0")
    connectToServer();
}

