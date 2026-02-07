


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

window.nclues = 0;

function startAP(puzzle_dict){
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
            function startWithPuzzle(puzzle_dict){
                window.chosenPuzzle = puzzle_dict;
                window.checked_locations = [];
                
                window.startEverything(window.chosenPuzzle, []);
                document.getElementById("login-container").style.display = "none";
                document.getElementById("leftBar").style.display = "flex";
                document.getElementById("rightBar").style.display = "flex";
                document.getElementById("bottomBar").style.display = "flex";
                document.getElementById("mainArea").style.display = "flex";
                window.is_connected = true;

                document.getElementById('labelMode').textContent = "Solo";

                gotClue();
            }

            function parsePythonDict(python_dict) {
                // This is a very naive parser and assumes the input is well-formed
                const jsonString = python_dict;
                return JSON.parse(jsonString);
            }

            console.log("Parsed offline puzzle python dict:", puzzle_dict);
            startWithPuzzle(puzzle_dict);
            

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
            const audio2 = new Audio('ding.mp3');
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

    const connectedListener = async (packet) => {
        document.getElementById("login-container").style.display = "none";
        document.getElementById("leftBar").style.display = "flex";
        document.getElementById("rightBar").style.display = "flex";
        document.getElementById("bottomBar").style.display = "flex";
        document.getElementById("mainArea").style.display = "flex";

        apstatus = "AP: Connected";
        console.log("Connected packet: ", packet);

        const puzzle = packet.slot_data.puzzle;
        const apworld = packet.slot_data.apworld_version;
        window.slot = packet.slot;
        console.log("AP World Version: ", apworld);
        if(apworld == "0.0.3"){
            alert("A new apworld is out. You will be redirected to an older version of the game that is compatible.");
            window.location.href = "https://nonogram.netlify.app/";
            return;
        }
        if(apworld == "0.1.0" || apworld == "0.1.1"){
            alert("A new apworld is out. You will be redirected to an older version of the game that is compatible.");
            window.location.href = "https://nonograhmm011.netlify.app/";
            return;
        }

        const haveclues = packet.slot_data.enables_nonograhmm_hints;
        console.log("Have clues?", haveclues);
        if(haveclues === 0){
            console.log("Clues are disabled for this world, hiding clue related UI...");
            document.getElementById('modeTip').style.display = "none";      
        }

        document.getElementById('labelMode').textContent = "AP";
        
        window.checked_locations = packet.checked_locations || [];
        window.startEverything(puzzle);

        window.is_connected = true;

        let keys = [`NNH_${window.slot}`];
        let results = (await client.storage.fetch(keys, true))
        console.log(results);
        window.gotSaveData(results[`NNH_${window.slot}`] || null);


        await client.storage.notify(keys, (key, value, oldValue) => {
            console.log("notify", key, value, oldValue);
            window.gotSaveData( value);
        });

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
        for(let o of packet.checked_locations){
            if(!window.checked_locations.includes(o)){
                window.checked_locations.push(o);
            }
            //sort:
            window.checked_locations.sort((a,b)=>a-b);
            console.log("Updated checked locations:", window.checked_locations);
        }
        window.updateNextUnlockCount();
    };

    function findAndDetermineChecks(total){
        console.log("Finding and determining checks for total:", total);
        sendCheck(67 + total);
        if(!window.checked_locations.includes(67 + total)){
            window.checked_locations.push(67 + total);
        }
        window.updateNextUnlockCount();
    }
    window.findAndDetermineChecks = findAndDetermineChecks;

    function sendCheck(key){
        if(window.is_connected){
            if(window.solo){
                console.log("Solo mode, pretending to check ", key);
                gotClue();
                const audio2 = new Audio('ding.mp3');
                audio2.volume = .3;
                audio2.play();
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

    function saveBoard(puzzle){
        console.log("Saving board to AP storage maybe...", puzzle);
        if(window.is_connected){
            if(window.solo){
                return;
            }
            let puzzle2 = puzzle;
            let nfilled = 0;
            for (let i = 0; i < puzzle2.length; i++){
                for (let j = 0; j < puzzle2[i].length; j++){
                    if(puzzle2[i][j] == 0.5 || puzzle2[i][j] == 0.6){
                        puzzle2[i][j] = 0;
                    }
                    if (puzzle2[i][j] == 1 || puzzle2[i][j] == -1){
                        nfilled += 1;
                    }

                }
            }
            console.log("Number of filled cells:", nfilled, "Previous saved filled cells:", window.nfilled_server);
            if(nfilled > window.ncorrect_server){
                const key_name = `NNH_${window.slot}`;
                const value = puzzle2;
                client.storage.prepare(key_name, 0).replace([nfilled,value]).commit();
                console.log("Saved board to AP storage.");
                window.ncorrect_server = nfilled;
            }
        }
    }

    window.sendCheck = sendCheck;
    window.sendGoal = sendGoal;
    window.saveBoard = saveBoard;

    console.log("0.2.0")
    connectToServer();
}

if(getUrlParameter('solo')){
    window.solo = true;

    let filename = "";
    let puzzleNum = null;

    window.soloParam = getUrlParameter('solo'); // e.g. "5_5_0" or "5_5_0_3"
    const parts = window.soloParam ? window.soloParam.split('_').filter(p => p.length > 0) : [];

    filename = `solo_puzzles/P_${window.soloParam}.txt`;

    fetch(filename)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch solo puzzle file');
        return res.text();
      })
      .then(text => {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) throw new Error('No puzzles found in file');
        let choice = null;
        if (puzzleNum !== null && puzzleNum > 0 && puzzleNum <= lines.length) {
            choice = lines[puzzleNum - 1];
        } else {
            choice = lines[Math.floor(Math.random() * lines.length)];
        }
        startAP(choice);
      })
      .catch(err => {
        console.error("Error loading solo puzzle:", err);
      });
}
