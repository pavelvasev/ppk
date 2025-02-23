import os
from ppk.genesis.lib import *
import ppk.genesis.base_types

"""
idea 
внедрить ссылки прямо в params, как вариант развития событий..
тогда
gen.node( "alfa", p1={"links_in":"c4",value: 5}, changed={"links_out":"sigma"})
ну такое..

"""


# адаптер для массивов links_in/out,tags чтобы если строка указана то это массив 1 шт
# крайне повышает удобство
def convert_str_to_list(dictionary):
    return {k: [v] if isinstance(v, str) else v for k, v in dictionary.items()}

def node( type, value=None, links_in={}, links_out={}, items=[], tags=[], **params ):
    links_in = convert_str_to_list(links_in)
    links_out = convert_str_to_list(links_out)
    if value is not None:
        params = params.copy()
        params["value"] = value    
    
    return {"type":type,"params":params,"items":items,"links_in":links_in,"links_out":links_out,"tags":tags}

