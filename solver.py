import ast
from pathlib import Path
import random
from random import choice
import copy

from tqdm import tqdm

from generateRandomPicross import generate_random_clues
from figure_out_line import get_sure_squares
from gen_list_of_puzzles import make_lists_of_puzzles
import json



def solve_picross_simple(all_clues):
    #  1 is filled, 3 is empty, 0 is unknown
    X = len(all_clues[0])
    Y = len(all_clues[1])
    grid = [[0 for _ in range(X)] for _ in range(Y)]
    
    todo = []
    todo += [(0, c) for c in range(X)]
    todo += [(1, r) for r in range(Y)]
    
    while todo:
        this_todo = todo.pop(0)
        side, index = this_todo
        if side == 0:
            c = index
            clues = all_clues[0][c]
            grid_part = [grid[r][c] for r in range(Y)]
            sol = get_sure_squares(clues, grid_part)
            if sol is False:
                return False
            for r in range(Y):
                if grid[r][c] != sol[r]:
                    todo.append((1, r))
                grid[r][c] = sol[r]
                
        else:
            r = index
            clues = all_clues[1][r]
            grid_part = grid[r]
            sol = get_sure_squares(clues, grid_part)
            if sol is False:
                return False
            for c in range(X):
                if grid[r][c] != sol[c]:
                    todo.append((0, c))
                grid[r][c] = sol[c]
    amount_sure = sum(1 for r in range(Y) for c in range(X) if grid[r][c] in (1,3))
    return grid, amount_sure


def build_up_game(clues):
    """
    Build up the game state from clues.
    Start with all clue entries replaced by "?" and report how many cells can be
    determined. Then repeatedly pick a random "?" and replace it with the actual
    number from `clues`, re-solve, and report the number of filled/empty cells
    after each replacement and which clue was changed.

    Returns a list of step records: dicts with keys
      - step: int (0 = initial masked state)
      - changed: None or (side, line_index, pos_index, value) where side 0=top,1=left
      - marked: number of marked cells after solving
      - masked_clues: deep copy of the current masked clues
    """

    # deep copy original clues to avoid mutating caller data
    orig = [ [list(cl) for cl in part] for part in (clues[0], clues[1]) ]
    
    sss = solve_picross_simple(orig)
    if sss is False:
        return False
    SOL, N = sss
    
    # if SOL doesn't contain any 0s:
    if N == len(clues[0]) * len(clues[1]):
        # print("The provided clues lead to a unique solution!")
        # showSolution(SOL)
        pass
    else:
        # print("The provided clues do not lead to a unique solution.")
        return False
    

    # create masked version: replace each entry in each clue-list with "?"
    masked = [ [ ["?" for _ in cl] for cl in part ] for part in orig ]

    def collect_positions(mask):
        pos = []
        for side in (0, 1):
            for li, cl in enumerate(mask[side]):
                for pi, val in enumerate(cl):
                    if val == "?":
                        pos.append((side, li, pi))
        return pos

    steps = []
    # initial solve with all "?"
    top_mask = [list(cl) for cl in masked[0]]
    left_mask = [list(cl) for cl in masked[1]]
    sol, marked = solve_picross_simple([top_mask, left_mask])
    steps.append({
        "step": 0,
        "changed": None,
        "marked": marked,
        "solution": sol,
    })

    step = 1
    positions = collect_positions(masked)
    with tqdm(total=len(positions)) as pbar:
        while positions:
            side, li, pi = choice(positions)
            # install the real value from orig into masked
            value = orig[side][li][pi]
            masked[side][li][pi] = value

            # prepare solver input (deep copy to avoid accidental sharing)
            top_mask = [list(cl) for cl in masked[0]]
            left_mask = [list(cl) for cl in masked[1]]
            solution, marked = solve_picross_simple([top_mask, left_mask])

            steps.append({
                "step": step,
                "changed": (side, li, pi, value),
                "marked": marked,
                "solution": solution,
            })
            step += 1
            positions = collect_positions(masked)
            pbar.update(1)

    return steps, solution

def showSolution(solution):
    if solution is None:
        print("No solution available")
        return
    for row in solution:
        line = "".join(
            "#" if cell == 1 else
            "." if cell == 3 else
            "?"
            for cell in row
        )
        print(line)
    print()

if __name__ == "__main__":
    random_seed = random.randint(0, 1000000)
    # random_seed = 268055
    print("Using random seed:", random_seed)
    random.seed(random_seed)
    
    am_puzzles = 0 # don't change ><
    
    start = 1
    max_puzzles = 10
    
    with tqdm(total=max_puzzles) as pbar:
        while am_puzzles < max_puzzles:
            
            n = random.choices([5,10,15,20], weights=[0,0,1,0])[0]
            x = n
            y = n

            pars = {
                5: [3, 1.5],
                10: [3, 2],
                15: [4, 3],
                20: [5, 4.2],
            }
            rando_clues = generate_random_clues(x, y, pars[n][0], pars[n][1])
            if not rando_clues:
                continue

            top_clues = rando_clues[0]
            left_clues = rando_clues[1]
            CLUES = [
                top_clues,
                left_clues
            ]

            build_up = build_up_game(CLUES)
            if not build_up:
                continue
            
            steps = build_up[0]

                
            give_away = {}
            number_possible = 0
            
            for info in steps:
                if number_possible not in give_away:
                    give_away[number_possible] = []
                give_away[number_possible] += [info["changed"]]
                number_possible = info["marked"]
                
            output = {
                "T": top_clues,
                "L": left_clues,
                "S": steps[-1]["solution"],
                "G": give_away
            }
            
            # make puzzles and spoilers directories if they don't exist
            Path("Site/puzzles").mkdir(exist_ok=True)
            Path("Site/spoilers").mkdir(exist_ok=True)

            with open(f"Site/puzzles/p_{x}_{y}_{len(give_away)}_{start + am_puzzles + 1}.json", "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2, separators=(',', ':'), ensure_ascii=False)

            with open(f"Site/spoilers/p_{x}_{y}_{len(give_away)}_{start + am_puzzles + 1}.txt", "w", encoding="utf-8") as f:
                marked = -1
                for step in steps:
                    if step['marked'] != marked:
                        f.write(f"# clues: {step['step']:3},  # possible: {step['marked']:3}\n")
                        for row in step["solution"]:
                            line = "".join(
                                "#" if cell == 1 else
                                "." if cell == 3 else
                                "?"
                                for cell in row
                            )
                            f.write(line + "\n")
                        f.write("\n")
                    marked = step['marked']
            
            am_puzzles += 1
            pbar.update(1)
    make_lists_of_puzzles()