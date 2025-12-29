// Function to get URL parameters
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

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


let nclues = 0;
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

                const displayName = chosenPuzzle.replace(/\.json$/i, '');
                const puzzleNameEl = document.getElementById('puzzleName');
                puzzleNameEl.textContent = displayName;

                const url = "spoilers/" + encodeURIComponent(displayName) + ".txt";
                const fullUrl = new URL(url, window.location.href).href;
                console.log("--------------------------------");
                console.log("SPOILER LOG URL: " + fullUrl);
                console.log("--------------------------------");

                document.getElementById('labelMode').textContent = "Solo";

                gotClue();
            }

            let custom_puzzle = getUrlParameter('puzzle');
            if(custom_puzzle != ""){
                console.log("Using custom puzzle from URL:", custom_puzzle);
                startWithPuzzle(custom_puzzle+".json");
            }else{
                let plname = "lists/pl_"+size+".json";
                console.log("Loading puzzle list:", plname);
                fetch(plname)
                    .then(res => res.json())
                    .then(list => {
                        const chosenPuzzle = Array.isArray(list) && list.length
                            ? list[Math.floor(Math.random() * list.length)]
                            : list;
                        startWithPuzzle(chosenPuzzle);
                    })
                    .catch(err => console.error("Failed to load puzzle list:", err));
            }

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
        .login(hostport, name, "Nonogram", {password: password})
            .then(() => {
                console.log("Connected to the server");
            })
            .catch((error) => {
                console.log("Failed to connect", error);
                document.getElementById('error-label').innerText = error + "\n Common remedies: refresh room and check login info.";
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
        for (let i = 0; i < items.length; i++) {
            let item = items[i][0];
            if (item == "Nonogram clues") {
                gotClue();
            }
        }
    }

    function gotClue(){
        console.log("Got clue ", nclues);
        applyUnlocksForScore(nclues);
        nclues += 1;
        const inLogic = (() => {
            const obj = window.unlock_order || {};
            const keys = Object.keys(obj);
            return keys[Math.min(nclues, keys.length - 1)];
        })();
        document.getElementById('inLogicCount').innerText = inLogic !== undefined ? inLogic : '—';
        // play b1.ogg
        const audio = new Audio('b2.ogg');
        audio.volume = .4;
        audio.play();
    }

    const connectedListener = (packet) => {
        document.getElementById("login-container").style.display = "none";
        document.getElementById("app").style.display = "flex";

        apstatus = "AP: Connected";
        console.log("Connected packet: ", packet);

        const puzzle_name = packet.slot_data.puzzle;

        const displayName = puzzle_name.replace(/\.json$/i, '');
        const puzzleNameEl = document.getElementById('puzzleName');
        puzzleNameEl.textContent = displayName;
        
        const url = "spoilers/" + encodeURIComponent(displayName) + ".txt";
        const fullUrl = new URL(url, window.location.href).href;

        console.log("--------------------------------");
        console.log("SPOILER LOG URL: " + fullUrl);
        console.log("--------------------------------");

        document.getElementById('labelMode').textContent = "AP";
        
        window.checked_locations = packet.checked_locations || [];
        window.startEverything(puzzle_name);

        window.is_connected = true;

        // Add the event listener and keep a reference to the handler
        window.beforeUnloadHandler = function (e) {
            const confirmationMessage = "Are you sure you want to leave this page?";
            e.preventDefault();
            e.returnValue = confirmationMessage;
            return confirmationMessage;
        };
        window.addEventListener("beforeunload", window.beforeUnloadHandler);
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

    var highScore = 0
    function findAndDetermineChecks(total){
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
        //stop timer window.timerInterval
        clearInterval(window.timerInterval);
        if(window.solo){
            return;
        }
        client.goal();
        window.removeEventListener("beforeunload", window.beforeUnloadHandler);
    }

    window.sendCheck = sendCheck;
    window.sendGoal = sendGoal;

    console.log("0.0.3")
    connectToServer();
}