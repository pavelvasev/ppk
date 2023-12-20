// проект чего-то совмещенного
webapp
{
  start {
    data := data_1d

    compute1 := compute_1d {: me left right | :} input=@loop1
    loop1 := loop_1d input=@compute1 N=1000

  }

  screen {
    connect
    
    data: lib3d.buffer (reduce 10 | merge)
    
    graph: graph @data
  }
}