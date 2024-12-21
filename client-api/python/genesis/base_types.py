# #F-BASE-TYPES

import ppk.genesis.lib as gen

# потребность - нужен какой-то базовый узел-контейнер, который сам ничего хоть и не делает пусть
# но может содержать других узлов
class node:
    def __init__(self,rapi,description,parent):
        self.rapi = rapi
        self.parent = parent

        gen.apply_description( rapi, self, description )

	

gen.register({"node":node})
#gen.register({"define":do_define})
