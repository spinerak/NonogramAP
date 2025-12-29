
function startEverything(pathToPuzzle) {

    
    // Derived sizes
    let topClues;
    let leftClues;
    let COLS;
    let ROWS;

    let solution;
    let highScore = -1; // start -1 so score 0 counts as a new high score the first time
    
    const correctCountEl = document.getElementById('correctCount');
    const nextUnlockCountEl = document.getElementById('nextUnlockCount');
    const inLogicCountEl = document.getElementById('inLogicCount');



    (function(){
        // synchronous XHR so rest of script can rely on CLUES immediately
        const req = new XMLHttpRequest();
        req.open('GET', 'puzzles/' + pathToPuzzle, false);
        req.overrideMimeType('application/json');
        req.send(null);
        const ok = (req.status === 200) || (req.status === 0 && req.responseText);
        if(!ok){
            alert('This puzzle could not be loaded. Might be because I had to delete it, sorry about that...');
            throw new Error('puzzle not loaded');
        } 
        const data = JSON.parse(req.responseText || '{}');

        // accept multiple possible key styles
        topClues = data.T || [];
        leftClues = data.L || [];
        COLS = topClues.length;
        ROWS = leftClues.length;
        solution = data.S || [];
        // unlock/giveaway may be named "give_away" in your example
        window.unlock_order = data.G || {};

        updateNextUnlockCount();
        
        console.log('Loaded puzzle', topClues, leftClues, solution, window.unlock_order);

    })();


    /* UI elements */
    const boardGrid = document.getElementById('boardGrid');
    const btnMouse = document.getElementById('modeMouse'); // New mouse mode button
    const btnFill = document.getElementById('modeFill'); // Black
    const btnMark = document.getElementById('modeMark'); // White
    const btnErase = document.getElementById('modeErase'); // Erase
    const modeLabel = document.getElementById('modeLabel');
    const resetBtn = document.getElementById('resetBtn');

    let maxTopRows = Math.max(0, ...topClues.map(a=>a.length));
    let maxLeftNumbers = Math.max(0, ...leftClues.map(a=>a.length));

    /* set CSS variables */
    /* compute left clue width to match number of left-clue columns * cell-size so gaps match top clues */
    const root = document.documentElement;
    root.style.setProperty('--cols', COLS);
    root.style.setProperty('--rows', ROWS);
    root.style.setProperty('--top-clue-rows', maxTopRows);
    const cellSizePx = parseInt(getComputedStyle(root).getPropertyValue('--cell-size')) || 40;
    const leftWidthPx = Math.max(48, maxLeftNumbers * cellSizePx);
    root.style.setProperty('--left-clue-width', leftWidthPx + 'px');

    /* State: 0 empty, 1 filled(black), 3 marked (white) */
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
                // keep the real number in dataset, display depends on revealed flag
                el.dataset.real = String(num);
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
                el.dataset.real = String(num);
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


    }

    /* Helper to set class based on state */
    function applyCellClass(el, state){
        el.classList.toggle('filled', state===1);
        el.classList.toggle('marked', state===3);
    }

    /* Reveal helper: updates revealed arrays and DOM */
    function revealTopClue(colIndex, itemIndex = null){
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
                n.textContent = n.dataset.real;
                n.title = `Column ${colIndex+1} clue ${n.dataset.real}`;
                n.classList.add('new');
            }
        });
    }

    function revealLeftClue(rowIndex, itemIndex = null){
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
                n.textContent = n.dataset.real;
                n.title = `Row ${rowIndex+1} clue ${n.dataset.real}`;
                n.classList.add('new');
            }
        });
    }

    /* Apply unlocks for a given score value.
    window.unlock_order can be an object or array. Each unlock entry is expected to have at least:
        [side, lineIndex, ...]
    side: 0 => top (column), 1 => left (row).
    We'll reveal the entire clue line when unlocking.
    */
    function applyUnlocksForScore(index){
        let kp = null;
        if(Array.isArray(window.unlock_order)){
            kp = window.unlock_order[index];
        } else if(window.unlock_order && typeof window.unlock_order === 'object'){
            const keys = Object.keys(window.unlock_order)
                .map(k=>Number(k))
                .filter(k=>!isNaN(k))
                .sort((a,b)=>a-b);
            const key = keys[index];
            if(key !== undefined) kp = window.unlock_order[String(key)];
        }
        if(!kp) return;
        // kp may be an array of unlock tuples
        if(!Array.isArray(kp)) return;
        // remove 'new' class from previously revealed clues
        const newEls = boardGrid.querySelectorAll('.clue-cell.new');
        newEls.forEach(el=>el.classList.remove('new'));


        for(const u of kp){
            if(!u || !Array.isArray(u)) continue;
            const side = Number(u[0]);
            const lineIndex = Number(u[1]);
            const hintIndex = Number(u[2]);
            if(isNaN(side) || isNaN(lineIndex) || isNaN(hintIndex)) continue;
            if(side === 0){
                revealTopClue(lineIndex, hintIndex);
            } else {
                revealLeftClue(lineIndex, hintIndex);
            }
        }
    }
    window.applyUnlocksForScore = applyUnlocksForScore;

    /* Decide action from event (mouse middle-click => erase; right-click => white; left => black; touch/pen use UI mode) */
    function decideActionFromEvent(ev){
        if(drawAction === 'mouse'){
            if(ev.pointerType === 'touch' || ev.pointerType === 'pen' || ev.button === 0){
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
    function setCellState(r,c,action){
        if(r<0||r>=ROWS||c<0||c>=COLS) return;
        if(r === lastCellSetR && c === lastCellSetC && action === lastCellSetV){
            return;
        }
        lastCellSetR = r;
        lastCellSetC = c;
        lastCellSetV = action;

        // play b1.ogg
        const audio = new Audio('b1.ogg');
        audio.volume = .4;
        audio.play();
        
        const prev = cells[r][c];
        let newState;
        if(action === 'black') newState = 1;
        else if(action === 'white') newState = 3;
        else if(action === 'erase') newState = 0;
        else return;
        if(prev === newState) return;
        cells[r][c] = newState;
        // find the cell element by data attributes
        const sel = `div[data-role="cell"][data-r="${r}"][data-c="${c}"]`;
        const cellEl = boardGrid.querySelector(sel);
        if(cellEl) applyCellClass(cellEl, newState);

        // update correct count if solution present
        updateCorrectCount();
    }

    /* Update correct markings count.
    We treat a cell as correct when:
        - it's filled (state===1) and the solution for that position is truthy
        - OR it's marked (state===3) and the solution for that position is falsy (0/undefined)
    If solution missing or size mismatch we show "—".
    */
    function updateCorrectCount(){
        if(!solution || !Array.isArray(solution) || solution.length !== ROWS){
            correctCountEl.textContent = '—';
            nextUnlockCountEl.textContent = '—';
            inLogicCountEl.textContent = '—';
            return;
        }
        let correct = 0;

        for(let r=0;r<ROWS;r++){
            const solRow = solution[r] || new Array(COLS).fill(0);
            for(let c=0;c<COLS;c++){
                const sol = solRow[c]; // expected values matching state: 0 or 1/3 etc. We'll compare strictly
                const st = cells[r][c];
                if(sol === st) correct++;
            }
        }
        

        // track high score and apply unlocks when a new high is reached
        if(correct > highScore){
            highScore = correct;
            if(window.is_connected && window.unlock_order){
                // if highscore is one of the keys in window.unlock_order, find the how many'th that is,
                // then call findAndDetermineChecks with that index
                const scores = Object.keys(window.unlock_order).map(k=>Number(k)).sort((a,b)=>a-b);
                // console.log(scores);
                if(scores.includes(highScore)){
                    const index = scores.indexOf(highScore);
                    window.findAndDetermineChecks(index);
                    
                    if(highScore === scores[scores.length - 1]){
                        if(COLS*ROWS > 64){
                            showRoss();
                        }
                        window.sendGoal();
                    }
                }
            }
        }
        correctCountEl.textContent = correct + ' / ' + (ROWS * COLS);
    }

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
        const keys = Object.keys(window.unlock_order).map(Number).filter(k => !isNaN(k)).sort((a,b) => a - b);
        best_correct = (keys[X] !== undefined) ? keys[X] : 'done!';
        nextUnlockCountEl.textContent = best_correct;
    }
    window.updateNextUnlockCount = updateNextUnlockCount;

    let drawActionMouse = 'black';
    /* Pointer handlers */
    function onPointerDown(ev){
        ev.preventDefault();
        try{ ev.currentTarget.setPointerCapture(ev.pointerId); }catch(e){}
        drawing = true;
        activePointerId = ev.pointerId;
        drawActionMouse = decideActionFromEvent(ev);
        const r = Number(ev.currentTarget.dataset.r);
        const c = Number(ev.currentTarget.dataset.c);
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
        updateModeUILabel();
    }
    btnMouse.addEventListener('click', ()=>setMode('mouse'));
    btnFill.addEventListener('click', ()=>setMode('black'));
    btnMark.addEventListener('click', ()=>setMode('white'));
    btnErase.addEventListener('click', ()=>setMode('erase'));
    function updateModeUILabel(){
        let label = 'Black';
        if(drawAction === 'white') label = 'White';
        else if(drawAction === 'erase') label = 'Erase';
        else if(drawAction === 'mouse') label = 'Mouse';
        modeLabel.textContent = label;
        btnMouse.classList.toggle('active', drawAction === 'mouse');
        btnFill.classList.toggle('active', drawAction === 'black');
        btnMark.classList.toggle('active', drawAction === 'white');
        btnErase.classList.toggle('active', drawAction === 'erase');
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
    // treat score 0 as new highscore on first load: reveal any unlocks for 0
    // applyUnlocksForScore(0);
    updateModeUILabel();
    updateCorrectCount();
}

window.startEverything = startEverything;
// startEverything('puzzles\\p_10_10_5_7.json');
