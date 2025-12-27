def get_sure_squares(clues, grid_line):
    def all_configurations(clues, m):        
        n = len(clues)
        if n == 0:
            return [[]]

        # minimal length for each clue ( '?' -> 1, otherwise numeric )
        min_lengths = []
        for c in clues:
            if c == '?':
                min_lengths.append(1)
            else:
                min_lengths.append(int(c))

        configs = []
        curr = []

        def backtrack(idx, pos_min):
            if idx == n:
                configs.append(curr.copy())
                return

            # minimal total length required from idx..end (including 1-space between blocks)
            remaining_blocks = n - idx
            min_total_from_idx = sum(min_lengths[idx:]) + max(0, remaining_blocks - 1)
            max_start = len(grid_line) - min_total_from_idx

            for s in range(pos_min, max_start + 1):
                if clues[idx] != '?':
                    length = int(clues[idx])
                    curr.append([s, length])
                    backtrack(idx + 1, s + length + 1)
                    curr.pop()
                else:
                    # compute minimal total AFTER current block
                    if idx == n - 1:
                        min_after = 0
                    else:
                        min_after = sum(min_lengths[idx + 1:]) + max(0, (n - idx - 1) - 1)
                    max_len = len(grid_line) - s - min_after
                    for length in range(1, max_len + 1):
                        curr.append([s, length])
                        backtrack(idx + 1, s + length + 1)
                        curr.pop()

        backtrack(0, 0)
        return configs

    configs = all_configurations(clues, len(grid_line))

    def write_out_configuration(configs, m):
        valid_configs = []
        for config in configs:
            line = [3] * m
            for start, length in config:
                for i in range(start, start + length):
                    line[i] = 1
            valid_configs.append(line)
        return valid_configs
            
    squares = write_out_configuration(configs, len(grid_line))
    
    valid_configs = []
    for square in squares:
        # compare with grid_line, OK if there is no conflict (one is 1 where the other is 3)
        conflict = any((g != 0 and g != v) for v, g in zip(square, grid_line))
        if not conflict:
            valid_configs.append(square)

        squares = valid_configs
    
    if not valid_configs:
        # print("\n\n")
        # print(clues, grid_line)
        # print(configs)
        # print(squares)
        return False
        return [0] * len(grid_line)
    
    # check all entries in valid_configs, if all have 1 in the same position, mark that position as 1, if all have 3 in the same position, mark that position as 3, else 0
    sure_squares = []
    for i in range(len(grid_line)):
        all_ones = all(square[i] == 1 for square in squares)
        all_threes = all(square[i] == 3 for square in squares)
        if all_ones:
            sure_squares.append(1)
        elif all_threes:
            sure_squares.append(3)
        else:
            sure_squares.append(0)
    return sure_squares

if __name__ == "__main__":
    print(get_sure_squares([3, '?', 2], [0,0,0,0,1,1,1,1,0,0,0,0]))