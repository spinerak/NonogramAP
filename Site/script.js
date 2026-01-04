


// Function to get URL parameters
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

function startEverything(puzzle) {
    function parsePythonDict(python_dict) {
        // This is a very naive parser and assumes the input is well-formed
        const jsonString = python_dict;
        return JSON.parse(jsonString);
    }

    puzzle = parsePythonDict(puzzle);
    console.log('Starting puzzle', puzzle);

    // Derived sizes
    let topClues = puzzle['C'][0];
    let leftClues = puzzle['C'][1];
    let COLS = topClues.length;
    let ROWS = leftClues.length;


    let solution = puzzle['S'];
    window.unlock_order = puzzle['G'];
    window.unlock_keys = [0];
    for (const k of window.unlock_order){
        const value_to_add = k[1]
        if(!window.unlock_keys.includes(value_to_add)){
            window.unlock_keys.push(value_to_add);
        }
    }

    let highScore = -1; // start -1 so score 0 counts as a new high score the first time
    let highScoreCheckpoint = -1;
    
    const filledCountEl = document.getElementById('filledCount');
    const nextUnlockCountEl = document.getElementById('nextUnlockCount');
    const inLogicCountEl = document.getElementById('inLogicCount');

    updateNextUnlockCount();
        
    console.log('Loaded puzzle', topClues, leftClues, solution, window.unlock_order);



    /* UI elements */
    const boardWrap = document.getElementById('boardWrap');
    const boardGrid = document.getElementById('boardGrid');
    const btnMouse = document.getElementById('modeMouse'); // New mouse mode button
    const btnFill = document.getElementById('modeFill'); // Black
    const btnMark = document.getElementById('modeMark'); // White
    const btnErase = document.getElementById('modeErase'); // Erase
    const btnCross = document.getElementById('modeCross'); // Cross
    const resetBtn = document.getElementById('resetBtn');

    let maxTopRows = Math.max(0, ...topClues.map(a=>a.length));
    let maxLeftNumbers = Math.max(0, ...leftClues.map(a=>a.length));


    /* set CSS variables */
    /* compute left clue width to match number of left-clue columns * cell-size so gaps match top clues */
    const root = document.documentElement;
    root.style.setProperty('--cols', COLS);
    root.style.setProperty('--rows', ROWS);
    
    // compute cell size in JS and set as static px value
    function updateCellSize(){
        const controlsEl = document.getElementById('controls') || document.querySelector('.controls');
        const controlsW = controlsEl ? controlsEl.getBoundingClientRect().width : 0;
        const CARD_PADDING = 16; // px padding around the card/container
        const CARD_GAP = 12; // px gap between controls and board
        const controlsH = controlsEl ? controlsEl.getBoundingClientRect().height : 0;
        const mqSmallPortrait = window.matchMedia && window.matchMedia('(max-width: 834px) and (orientation: portrait)').matches;
        let wrapW, wrapH;
        if(mqSmallPortrait){
            // In small portrait, don't subtract controlsW and CARD_GAP from width;
            // subtract controlsH and CARD_GAP from height.
            wrapW = Math.max(0, window.innerWidth - (CARD_PADDING * 2));
            wrapH = Math.max(0, window.innerHeight - controlsH - (CARD_PADDING * 2) - CARD_GAP);
        } else {
            wrapW = Math.max(0, window.innerWidth - controlsW - (CARD_PADDING * 2) - CARD_GAP);
            wrapH = Math.max(0, window.innerHeight - (CARD_PADDING * 2));
        }

        console.log('wrap size', wrapW, wrapH);
        let colsTotal = ((COLS || 0) + (maxLeftNumbers || 0)) || 1;
        // colsTotal += 1;
        let rowsTotal = ((ROWS || 0) + (maxTopRows || 0)) || 1;
        // rowsTotal += 1;
        const cellSizePx = Math.max(8, Math.floor(Math.min(wrapW / colsTotal, wrapH / rowsTotal))) / 1.15; // floor to integer, min 8px
        root.style.setProperty('--cell-size', cellSizePx + 'px');
        console.log('calculation:', wrapW, '/', colsTotal, 'and', wrapH, '/', rowsTotal, '=> cell size', cellSizePx);
    }

    // initial call
    updateCellSize();
    // call on window resize
    window.addEventListener('resize', updateCellSize);
    // call on boardGrid resize if supported
    // if (typeof ResizeObserver !== 'undefined' && boardGrid){
    //     const ro = new ResizeObserver(updateCellSize);
    //     ro.observe(boardGrid);
    // }


    /* State: 0 empty, 1 filled(black), -1 marked (white) */
    let cells = new Array(ROWS).fill(0).map(()=>new Array(COLS).fill(0));
    let drawing = false;
    let drawAction = 'mouse'; // 'black' or 'white' or 'erase'
    let activePointerId = null;

    /* track clue done states so clicks persist until reset */
    const topDone = topClues.map(col => new Array(col.length).fill(false));
    const leftDone = leftClues.map(row => new Array(row.length).fill(false));

    /* track revealed (visible) state for clues; start all hidden */
    const topRevealed = topClues.map(col => new Array(col.length).fill(false));
    const leftRevealed = leftClues.map(row => new Array(row.length).fill(false));

    /* Helpers to compute grid template sizes and construct grid */
    function buildBoardGrid(){
        // We'll create maxLeftNumbers columns for left-clues (one per possible number slot),
        // then COLS columns for the puzzle cells. This ensures horizontal spacing of left clues
        // matches the vertical spacing of top clues (both use var(--cell-size) columns).
        const totalCols = maxLeftNumbers + COLS;
        const totalRows = maxTopRows + ROWS;

        // build template strings
        const leftColsTemplate = `repeat(${maxLeftNumbers}, var(--cell-size))`;
        const cellColsTemplate = `repeat(${COLS}, var(--cell-size))`;
        const colsTemplate = `${leftColsTemplate} ${cellColsTemplate}`;

        // each top clue row we use a small height based on clue font line-height
        const clueRowHeight = `calc(var(--clue-font) * 1.6)`;
        const rowsTemplate = `repeat(${maxTopRows}, ${clueRowHeight}) repeat(${ROWS}, var(--cell-size))`;

        boardGrid.style.gridTemplateColumns = colsTemplate;
        boardGrid.style.gridTemplateRows = rowsTemplate;

        // clear existing children
        boardGrid.innerHTML = '';

        // add top-left corner blank that spans all left-clue columns (keeps spacing consistent)
        const corner = document.createElement('div');
        const cornerColStart = 1;
        const cornerColEnd = maxLeftNumbers + 1;
        const cornerRowStart = 1;
        const cornerRowEnd = maxTopRows + 1;
        corner.style.gridColumn = `${cornerColStart} / ${cornerColEnd}`;
        corner.style.gridRow = `${cornerRowStart} / ${cornerRowEnd}`;
        corner.className = 'clue-cell';
        corner.style.background = 'transparent';

        // add major gridlines for corner if it sits on the boundary to puzzle area
        // vertical major line after left clues: colEnd === maxLeftNumbers + 1
        if(cornerColEnd === maxLeftNumbers + 1) corner.classList.add('major-v');
        // horizontal major line after top clues: rowEnd === maxTopRows + 1
        if(cornerRowEnd === maxTopRows + 1) corner.classList.add('major-h');

        boardGrid.appendChild(corner);

        // render top clues: for each column, each number placed into its own grid cell, bottom-aligned inside the top-clue area
        for(let c=0;c<COLS;c++){
            const col = topClues[c] || [];
            // for bottom alignment within top-clue rows:
            // place numbers at rows (maxTopRows - col.length + 1) .. maxTopRows
            for(let i=0;i<col.length;i++){
                const num = col[i];
                // target row index (1-based)
                const targetRowStart = (maxTopRows - col.length) + 1 + i;
                const targetRowEnd = targetRowStart + 1;
                const colStart = (maxLeftNumbers + 1 + c);
                const colEnd = colStart + 1;

                const el = document.createElement('div');
                el.className = 'clue-cell top';
                
                el.dataset.type = 'top';
                el.dataset.col = c;
                el.dataset.index = i;
                // display "?" unless revealed
                const isRevealed = !!(topRevealed[c] && topRevealed[c][i]);
                el.textContent = isRevealed ? num : '?';
                // account for the left-clue columns when positioning top clues
                el.style.gridColumn = colStart + ' / ' + colEnd;
                el.style.gridRow = targetRowStart + ' / ' + targetRowEnd;
                el.title = `Column ${c+1} clue ${isRevealed ? num : '?'}${isRevealed ? '' : ' (hidden)'}`;
                el.addEventListener('click', onClueClick);
                // reflect done state
                if(topDone[c] && topDone[c][i]) el.classList.add('done');

                // major vertical: after left clues (colEnd === maxLeftNumbers+1) OR every 5 puzzle columns
                if(colEnd === maxLeftNumbers + 1 || (colStart > maxLeftNumbers && ((colStart - maxLeftNumbers) % 5 === 0))){
                    el.classList.add('major-v');
                }
                // major horizontal lines for top clues (if they sit on puzzle-row boundaries)
                if(targetRowEnd === maxTopRows + 1 || (targetRowStart > maxTopRows && ((targetRowStart - maxTopRows) % 5 === 0))){
                    el.classList.add('major-h');
                }

                boardGrid.appendChild(el);
            }
        }

        // render left clues: place numbers into the left-clue columns, right-aligned within that block
        for(let r=0;r<ROWS;r++){
            const row = leftClues[r] || [];
            // right-align numbers within maxLeftNumbers columns:
            // place numbers at columns (maxLeftNumbers - row.length + 1) .. maxLeftNumbers
            for(let i=0;i<row.length;i++){
                const num = row[i];
                const targetColStart = (maxLeftNumbers - row.length) + 1 + i;
                const targetColEnd = targetColStart + 1;
                const rowStart = (maxTopRows + 1 + r);
                const rowEnd = rowStart + 1;

                const el = document.createElement('div');
                el.className = 'clue-cell left';
                
                el.dataset.type = 'left';
                el.dataset.row = r;
                el.dataset.index = i;
                const isRevealed = !!(leftRevealed[r] && leftRevealed[r][i]);
                el.textContent = isRevealed ? num : '?';
                el.style.gridColumn = targetColStart + ' / ' + targetColEnd;
                el.style.gridRow = rowStart + ' / ' + rowEnd;
                el.title = `Row ${r+1} clue ${isRevealed ? num : '?'}${isRevealed ? '' : ' (hidden)'}`;
                el.addEventListener('click', onClueClick);
                // reflect done state
                if(leftDone[r] && leftDone[r][i]) el.classList.add('done');

                // major vertical lines: if this left-clue column is the last left-clue column (boundary) or further every 5 puzzle columns
                if(targetColEnd === maxLeftNumbers + 1 || (targetColStart > maxLeftNumbers && ((targetColStart - maxLeftNumbers) % 5 === 0))){
                    el.classList.add('major-v');
                }
                // major horizontal: after top-clue rows boundary or every 5 puzzle rows
                if(rowEnd === maxTopRows + 1 || (rowStart > maxTopRows && ((rowStart - maxTopRows) % 5 === 0))){
                    el.classList.add('major-h');
                }

                boardGrid.appendChild(el);
            }
        }

        // render cells: each goes into grid columns after the left-clue columns
        for(let r=0;r<ROWS;r++){
            for(let c=0;c<COLS;c++){
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.dataset.role = 'cell';
                const colStart = (maxLeftNumbers + 1 + c);
                const colEnd = colStart + 1;
                const rowStart = (maxTopRows + 1 + r);
                const rowEnd = rowStart + 1;
                cell.style.gridColumn = colStart + ' / ' + colEnd;
                cell.style.gridRow = rowStart + ' / ' + rowEnd;
                applyCellClass(cell, cells[r][c]);
                // pointer events
                cell.addEventListener('pointerdown', onPointerDown);
                cell.addEventListener('pointerenter', onPointerEnter);
                cell.addEventListener('pointerup', onPointerUp);
                cell.addEventListener('pointercancel', onPointerUp);

                // major vertical: after left-clues boundary OR every 5 puzzle columns
                if(colEnd === maxLeftNumbers + 1 || (colStart > maxLeftNumbers && ((colStart - maxLeftNumbers) % 5 === 0))){
                    cell.classList.add('major-v');
                }
                // major horizontal: after top-clues boundary OR every 5 puzzle rows
                if(rowEnd === maxTopRows + 1 || (rowStart > maxTopRows && ((rowStart - maxTopRows) % 5 === 0))){
                    cell.classList.add('major-h');
                }

                boardGrid.appendChild(cell);
            }
        }
        // Disable context menu on board
        boardGrid.addEventListener('contextmenu', e=>e.preventDefault());
        boardWrap.addEventListener('contextmenu', e=>e.preventDefault());
        updateCellSize();
        setTimeout(()=>updateCellSize(),1000);

    }

    /* Helper to set class based on state */
    function applyCellClass(el, state){
        el.classList.toggle('filled', state===1);
        el.classList.toggle('marked', state===-1);
        el.classList.toggle('cross', state===0.5);
        el.classList.toggle('cross2', state===0.6);
    }


    /* Reveal helper: updates revealed arrays and DOM */
    function revealTopClue(colIndex, itemIndex, value){
        if(colIndex < 0 || colIndex >= topClues.length) return;
        if(itemIndex === null){
            // reveal whole column
            for(let i=0;i<topClues[colIndex].length;i++) topRevealed[colIndex][i] = true;
        } else {
            if(itemIndex < 0 || itemIndex >= topClues[colIndex].length) return;
            topRevealed[colIndex][itemIndex] = true;
        }
        // update DOM items
        const nodes = boardGrid.querySelectorAll(`.clue-cell.top[data-col="${colIndex}"]`);
        nodes.forEach(n=>{
            const idx = Number(n.dataset.index);
            if(topRevealed[colIndex][idx] && itemIndex == idx){
                n.textContent = value;
                n.title = `Column ${colIndex+1} clue ${value}`;
                n.classList.add('new');
            }
        });
    }

    function revealLeftClue(rowIndex, itemIndex, value){
        if(rowIndex < 0 || rowIndex >= leftClues.length) return;
        if(itemIndex === null){
            for(let i=0;i<leftClues[rowIndex].length;i++) leftRevealed[rowIndex][i] = true;
        } else {
            if(itemIndex < 0 || itemIndex >= leftClues[rowIndex].length) return;
            leftRevealed[rowIndex][itemIndex] = true;
        }
        const nodes = boardGrid.querySelectorAll(`.clue-cell.left[data-row="${rowIndex}"]`);
        nodes.forEach(n=>{
            const idx = Number(n.dataset.index);
            if(leftRevealed[rowIndex][idx] && itemIndex == idx){
                n.textContent = value;
                n.title = `Row ${rowIndex+1} clue ${value}`;
                n.classList.add('new');
            }
        });
    }

    
    function revealClue(side, lineIndex, itemIndex, value){
        if(side === 0){
            revealTopClue(lineIndex, itemIndex, value);
        } else {
            revealLeftClue(lineIndex, itemIndex, value);
        }
    }

    /* Apply unlocks for a given score value.
    window.unlock_order can be an object or array. Each unlock entry is expected to have at least:
        [side, lineIndex, ...]
    side: 0 => top (column), 1 => left (row).
    We'll reveal the entire clue line when unlocking.
    */

    let highestUnlocked = -1;
    function applyUnlocksForScore(nclues){
        // if(nclues <= highestUnlocked) return;

        const newEls = boardGrid.querySelectorAll('.clue-cell.new');
        newEls.forEach(el=>el.classList.remove('new'));

        const val_to_unlock = window.unlock_keys[nclues];
        console.log('Applying unlocks for score', nclues, '=>', val_to_unlock);

        let ready_to_unlock = false;
        for(const v of window.unlock_order){
            if(ready_to_unlock){
                // console.log('Applying unlock for score', nclues, v);
                const u = v[0];
                if(u){
                    const side = Number(u[0]);
                    const lineIndex = Number(u[1]);
                    const hintIndex = Number(u[2]);
                    if(isNaN(side) || isNaN(lineIndex) || isNaN(hintIndex)) continue;
                    revealClue(side, lineIndex, hintIndex, u[3]);
                }
                if(v[1] > val_to_unlock){
                    break;
                }
            }
            if(v[1] == val_to_unlock){
                ready_to_unlock = true;
            }
        }
        highestUnlocked = nclues;
        console.log(nclues, window.nclues)
        if(window.unlock_keys[nclues+1] == window.unlock_keys[window.nclues]){
            // console.log('in logic update: done!', window.unlock_keys[nclues+1], window.unlock_keys[window.nclues]);
            inLogicCountEl.textContent = `${window.unlock_keys[nclues+1] === undefined ? 'done!' : window.unlock_keys[nclues+1]}`;
        }else{
            // console.log('in logic update:', window.unlock_keys[nclues+1], window.unlock_keys[window.nclues]);
            if(window.unlock_keys[window.nclues] === undefined){
                inLogicCountEl.textContent = `${window.unlock_keys[nclues+1]} now (${window.unlock_keys[window.nclues-1]} total)`;
            }else{
                inLogicCountEl.textContent = `${window.unlock_keys[nclues+1]} now (${window.unlock_keys[window.nclues]} total)`;
            }
        }
        
    }

    /* Decide action from event (mouse middle-click => erase; right-click => white; left => black; touch/pen use UI mode) */
    function decideActionFromEvent(ev){
        if(drawAction === 'mouse'){
            if(ev.pointerType === 'touch' || ev.pointerType === 'pen' || ev.button === 0){
                if (ev.shiftKey){
                    return 'cross';
                }
                return 'black';
            }
            if(ev.button === 1) return 'erase'; // middle
            if(ev.button === 2) return 'white'; // right
        }
        return drawAction;
    }

    let lastCellSetR = -1;
    let lastCellSetC = -1;
    let lastCellSetV = -1;

    /* Set a cell state with given action */
    function setCellState(r,c,action,force=false){
        let prev;
        if(!force){
            if(r<0||r>=ROWS||c<0||c>=COLS) return;
            if(r === lastCellSetR && c === lastCellSetC){
                if(action === lastCellSetV){
                    // console.log('skipping setCellState due to repeat', r, c, action);
                    return;
                }
            }
            if(action != drawActionMouse){
                // console.log('skipping setCellState due to action mismatch', action, drawActionMouse);
                return;
            }
            lastCellSetR = r;
            lastCellSetC = c;
            lastCellSetV = action;
            prev = cells[r][c];
            if(action !== 'erase' && !(action === 'cross' && (prev === 0.5 || prev === 0.6)) && replacing_color !== prev){
                lastCellSetR = -1;
                return;
            }
        }


        // play b1.ogg
        const audio1 = new Audio('b1.ogg');
        audio1.volume = .4;
        audio1.play();
        
        let newState;
        if(action === 'black') newState = 1;
        else if(action === 'white') newState = -1;
        else if(action === 'erase') newState = 0;
        else if(action === 'cross'){
            if(cells[r][c] === 0.5){
                newState = 0.6;
            }else{
                newState = 0.5;
            }
        } 
        else return;
        if(prev === newState) return;
        cells[r][c] = newState;
        // find the cell element by data attributes
        const sel = `div[data-role="cell"][data-r="${r}"][data-c="${c}"]`;
        const cellEl = boardGrid.querySelector(sel);
        if(cellEl){
            applyCellClass(cellEl, newState);
        }

        // update correct count if solution present
        checkAndUpdate();
    }

    function solveUntil(n){
        for(let r=0;r<ROWS;r++){
            for(let c=0;c<COLS;c++){
                const solRow = solution[r] || new Array(COLS).fill(0);
                const sol = solRow[c];
                if(sol[1] <= n){
                    const st = sol[0];
                    setCellState(r,c, st === 1 ? 'black' : 'white', true);
                }
            }
        }
    }
    window.solveUntil = solveUntil;

    /* Update correct markings count.
    We treat a cell as correct when:
        - it's filled (state===1) and the solution for that position is truthy
        - OR it's marked (state===-1) and the solution for that position is falsy (0/undefined)
    If solution missing or size mismatch we show "—".
    */
    function checkAndUpdate(showTip=false){
        if(!solution || !Array.isArray(solution) || solution.length !== ROWS){
            filledCountEl.textContent = '—';
            nextUnlockCountEl.textContent = '—';
            inLogicCountEl.textContent = '—';
            return;
        }
        let correct = 0;

        let filled = 0;
        let lowest_incorrect = Infinity;
        let list_incorrect = [];
        let loc_lowest_notknown = null;
        let highest_correct = 0;
        for(let r=0;r<ROWS;r++){
            const solRow = solution[r] || new Array(COLS).fill(0);
            for(let c=0;c<COLS;c++){
                const sol = solRow[c]; // expected values matching state: 0 or 1/-1 etc. We'll compare strictly
                const st = cells[r][c];
                if(st == 1 || st == -1){
                    filled += 1;
                }
                if(sol[0] === st){
                    if(sol[1] > highest_correct){
                        highest_correct = sol[1];
                    }
                }else{
                    if(st !== 0 && st !== 0.5){
                        list_incorrect.push([r,c]);
                    }
                    if(sol[1] < lowest_incorrect){
                        lowest_incorrect = sol[1];
                        loc_lowest_notknown = [r,c,sol[2]];
                    }
                }
            }
        }
        // update amount filled
        filledCountEl.textContent = filled + ' / ' + (ROWS * COLS);


        function markCellAsTip(r,c,cls){
            const sel = `div[data-role="cell"][data-r="${r}"][data-c="${c}"]`;
            const cellEl = boardGrid.querySelector(sel);
            if(cellEl){
                cellEl.classList.add(cls);
                setTimeout(()=>cellEl.classList.remove(cls), 2000);
            }
        }

        correct = lowest_incorrect === Infinity ? highest_correct : (lowest_incorrect - 1);
        if(showTip){
            if(list_incorrect.length > 0){
                // pick a random incorrect cell to highlight
                const idx = Math.floor(Math.random() * list_incorrect.length);
                const [r,c] = list_incorrect[idx];
                markCellAsTip(r,c,'tip-wrong');
            }else{
                if(loc_lowest_notknown === null) return;
                const [r,c,s] = loc_lowest_notknown;
                if (s == 0){
                    for (let rr=0;rr<ROWS;rr++){
                        markCellAsTip(rr,c,'tip-next');
                    }
                }
                if (s == 1){
                    for (let cc=0;cc<COLS;cc++){
                        markCellAsTip(r,cc,'tip-next');
                    }
                }
            }
            return;
        }
        

        // track high score and apply unlocks when a new high is reached
        if(correct > highScore){
            highScore = correct;
            if(window.is_connected && window.unlock_order){
                // if highscore is one of the keys in window.unlock_order, find the how many'th that is,
                // then call findAndDetermineChecks with that index

                if(window.unlock_keys.includes(highScore)){
                    const index = window.unlock_keys.indexOf(highScore);
                    console.log('New high score!', highScore, 'at index', index, 'in unlock keys', window.unlock_keys);
                    window.findAndDetermineChecks(index);

                    if(correct > highScoreCheckpoint){
                        highScoreCheckpoint = correct;
                    }
                    
                    if(highScore === window.unlock_keys[window.unlock_keys.length - 1]){
                        // if(COLS*ROWS > 64){
                            showRoss();
                        // }
                        window.sendGoal();
                    }
                }
            }
        }

        console.log('Correct count:', correct, 'nclues:', window.nclues, 'max', window.unlock_keys.length - 1);
        for(let i = 0; i <= window.unlock_keys.length; i++){
            if(correct >= window.unlock_keys[Math.min(i, window.unlock_keys.length - 1)] && window.nclues > i){
                // console.log('Updating nclues', window.nclues, 'to', i, 'for score', window.unlock_keys[i]);
                applyUnlocksForScore(i);
            }
        }
        
        window.setCheckpoint(highScoreCheckpoint);
    }

    document.getElementById('modeTip').addEventListener('click', ()=>{
        // find first incorrect cell and highlight it briefly
        checkAndUpdate(true);
    });
    window.checkAndUpdate = checkAndUpdate;

    function showRoss(){
        // thanks palex
        // merge the 4x4 CLUEcells top-left into one and place the image yes.png there
        // merge the top-left clue-area into one element and place yes.png there
        const merged = document.createElement('div');
        merged.className = 'clue-merged';
        merged.style.gridColumn = `1 / ${maxLeftNumbers + 1}`;
        merged.style.gridRow = `1 / ${maxTopRows + 1}`;
        merged.style.display = 'flex';
        merged.style.alignItems = 'center';
        merged.style.justifyContent = 'center';
        merged.style.background = 'transparent';
        merged.style.pointerEvents = 'none';
        const img = document.createElement('img');
        img.src = 'yes.png';
        img.alt = '';
        img.style.maxWidth = '90%';
        img.style.maxHeight = '90%';
        img.style.objectFit = 'contain';
        // start centered over the puzzle grid, almost as big as the grid.
        const gridRect = boardGrid.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        const centerX = gridRect.left + gridRect.width / 2;
        const centerY = gridRect.top + gridRect.height / 2;
        const initialScale = Math.min(1.25, (Math.min(gridRect.width, gridRect.height) * 0.9) / (Math.min(vw, vh) * 0.5) || 1);

        img.style.position = 'fixed';
        img.style.left = centerX + 'px';
        img.style.top = centerY + 'px';
        img.style.transform = `translate(-50%,-50%) scale(${initialScale})`;
        // start fully transparent and fade in; delay transform animation so movement happens after fade
        img.style.opacity = '0';
        img.style.transition = 'opacity 2000ms ease, transform 1000ms cubic-bezier(.2,.8,.2,1) 1200ms';
        img.style.zIndex = '9999';
        img.style.pointerEvents = 'none';
        document.body.appendChild(img);

        // force layout then fade in
        void img.offsetWidth;
        requestAnimationFrame(() => { img.style.opacity = '1'; });

        // after merged is appended (happens later in this function), animate img into place
        setTimeout(() => {
            const mergedRect = merged.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            const targetCX = mergedRect.left + mergedRect.width / 2;
            const targetCY = mergedRect.top + mergedRect.height / 2;
            // use the image starting center (centerX/centerY) as the origin so we move from the grid center to the merged target
            const deltaX = targetCX - centerX;
            const deltaY = targetCY - centerY;

            // final scale: make image slightly smaller to fit inside merged area
            const finalScale = Math.min(1, (mergedRect.width * 0.9) / (Math.min(vw, vh) * 0.5));

            img.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${finalScale})`;

            // when animation completes, make the image a normal child of merged and clear fixed positioning
            const cleanup = () => {
                img.removeEventListener('transitionend', cleanup);
                img.style.transition = '';
                img.style.position = '';
                img.style.left = '';
                img.style.top = '';
                img.style.transform = '';
                img.style.zIndex = '';
                img.style.pointerEvents = '';
                img.style.maxWidth = '90%';
                img.style.maxHeight = '90%';
                if (merged && merged !== img.parentElement) merged.appendChild(img);
            };
            img.addEventListener('transitionend', cleanup);
        }, 50);

        merged.appendChild(img);
        boardGrid.appendChild(merged);
    }

    function updateNextUnlockCount(){
        const arr = window.checked_locations || [];
        const seen = new Set(arr.filter(n => !isNaN(n)));
        let missing = 68;
        while(seen.has(missing)) missing++;
        const X = missing - 67; // 1-based
        best_correct = (window.unlock_keys[X] !== undefined) ? window.unlock_keys[X] : 'done!';
        nextUnlockCountEl.textContent = best_correct;
    }
    window.updateNextUnlockCount = updateNextUnlockCount;

    let drawActionMouse = 'black';
    let replacing_color = null;
    
    /* Pointer handlers */
    function onPointerDown(ev){
        ev.preventDefault();
        try{ ev.currentTarget.setPointerCapture(ev.pointerId); }catch(e){}
        drawing = true;
        activePointerId = ev.pointerId;
        drawActionMouse = decideActionFromEvent(ev);
        const r = Number(ev.currentTarget.dataset.r);
        const c = Number(ev.currentTarget.dataset.c);
        replacing_color = cells[r][c];
        setCellState(r,c,drawActionMouse);
        updateModeUILabel();
    }

    function onPointerEnter(ev){
        if(!drawing || activePointerId !== ev.pointerId){
            return;
        }
        const r = Number(ev.currentTarget.dataset.r);
        const c = Number(ev.currentTarget.dataset.c);
        setCellState(r,c,drawActionMouse);
    }

    function onPointerUp(ev){
        try{ ev.currentTarget.releasePointerCapture(ev.pointerId);}catch(e){}
        drawing = false;
        activePointerId = null;
    }

    /* Global pointermove for dragging across cells */
    document.addEventListener('pointermove', (ev)=>{
        if(!drawing || activePointerId !== ev.pointerId) return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        if(!el) return;
        const cellEl = el.classList && el.classList.contains('cell') ? el : el.closest && el.closest('.cell');
        if(!cellEl) return;
        const r = Number(cellEl.dataset.r);
        const c = Number(cellEl.dataset.c);
        setCellState(r,c,drawActionMouse);
    });

    /* Document-level pointerup */
    document.addEventListener('pointerup', ()=>{ 
        drawing = false;
        activePointerId = null;
    });

    /* Mode buttons */
    function setMode(m){
        drawAction = m;
        btnMouse.classList.toggle('active', m==='mouse');
        btnFill.classList.toggle('active', m==='black');
        btnMark.classList.toggle('active', m==='white');
        btnErase.classList.toggle('active', m==='erase');
        btnCross.classList.toggle('active', m==='cross');
        updateModeUILabel();
    }
    btnMouse.addEventListener('click', ()=>setMode('mouse'));
    btnFill.addEventListener('click', ()=>setMode('black'));
    btnMark.addEventListener('click', ()=>setMode('white'));
    btnErase.addEventListener('click', ()=>setMode('erase'));
    btnCross.addEventListener('click', ()=>setMode('cross'));
    function updateModeUILabel(){
        btnMouse.classList.toggle('active', drawAction === 'mouse');
        btnFill.classList.toggle('active', drawAction === 'black');
        btnMark.classList.toggle('active', drawAction === 'white');
        btnErase.classList.toggle('active', drawAction === 'erase');
        btnCross.classList.toggle('active', drawAction === 'cross');
    }

    /* Clue click handler: toggles "done" and fades item a bit */
    function onClueClick(ev){
        ev.stopPropagation();
        const t = ev.currentTarget;
        // top clues: dataset.type='top', dataset.col, dataset.index
        // left: clicking number spans has dataset.type='left'

        if(t.dataset.type === 'top'){
            const c = Number(t.dataset.col);
            const i = Number(t.dataset.index);
            topDone[c][i] = !topDone[c][i];
            t.classList.toggle('done', topDone[c][i]);
        } else if(t.dataset.type === 'left'){
            const r = Number(t.dataset.row);
            const i = Number(t.dataset.index);
            leftDone[r][i] = !leftDone[r][i];
            t.classList.toggle('done', leftDone[r][i]);
        } else {
            console.log('not clicking on clue.......', t)
        }
    }

    /* Reset and confirm logic (also clear clue-done & revealed states) */
    const CONFIRM_LABEL = 'Sure?';
    const RESET_LABEL = 'Reset';
    let confirmTimer = null;
    let awaitingConfirm = false;
    const CONFIRM_MS = 3000;

    resetBtn.addEventListener('click', ()=>{
        // showRoss();
        if(!awaitingConfirm){
            awaitingConfirm = true;
            resetBtn.textContent = CONFIRM_LABEL;
            if(confirmTimer) clearTimeout(confirmTimer);
            confirmTimer = setTimeout(()=>{
                awaitingConfirm = false;
                resetBtn.textContent = RESET_LABEL;
                confirmTimer = null;
            }, CONFIRM_MS);
        } else {
            if(confirmTimer){ clearTimeout(confirmTimer); confirmTimer = null; }
            awaitingConfirm = false;
            resetBtn.textContent = RESET_LABEL;

            // clear state
            cells = new Array(ROWS).fill(0).map(()=>new Array(COLS).fill(0));
            for(let c=0;c<topDone.length;c++) for(let i=0;i<topDone[c].length;i++) topDone[c][i] = false;
            for(let r=0;r<leftDone.length;r++) for(let i=0;i<leftDone[r].length;i++) leftDone[r][i] = false;
            
            buildBoardGrid();
        }
    });

    /* keyboard shortcuts */
    window.addEventListener('keydown', (e)=>{
        if(e.key === 'w') setMode('white');
        if(e.key === 'b') setMode('black');
        if(e.key === 'e') setMode('erase');
        // if(e.key === 'r') resetBtn.click();
    });

    /* initialize board */
    buildBoardGrid();
    updateModeUILabel();
    checkAndUpdate();
}

// keyboard shortcuts for modes 1-4
(function(){
    const keyMap = { '1':'modeFill', '2':'modeMark', '3':'modeErase', '4':'modeCross' };
    function activate(id){
    const btn = document.getElementById(id); if(!btn) return;
    // prefer triggering existing click handlers
    btn.click();
    // ensure visual active state
    const row = btn.closest('.mode-row'); if(!row) return;
    row.querySelectorAll('.btn').forEach(b => b.classList.toggle('active', b === btn));
    }
    document.addEventListener('keydown', e => {
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
    if (keyMap[e.key]) { activate(keyMap[e.key]); e.preventDefault(); }
    });
})();






window.startEverything = startEverything;
// startEverything('puzzles\\p_10_10_5_7.json');
