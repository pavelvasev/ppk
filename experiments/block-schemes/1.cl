process "map_blocks" {
  in {
    ctx: cell
    rapi: cell
    input: cell
    fn: cell
  }

  output: cell
  need_update: channel

  func "generate" {
  /*
    let res = f_map_blocks( ctx.get(), (args) => {
      //console.log('STEP got block',args);
      return args.input })( input.get() )
      */
    let res = f_map_blocks( ctx.get(), fn.get() )( input.get() )
    return res
  }
  
  bind @input @need_update

  /*
  react @input {:
    let r = generate()
    output.submit( r )
  :}
  */
}

//////////

compute {
  d1: init_data blocks=4
  map_blocks data=@d1.output {: args | console.log("see block",args); return args.input :}
  iterate n=1000 {
    f1_borders
  }
}