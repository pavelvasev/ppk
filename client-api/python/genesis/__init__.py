import os
from ppk.genesis.lib import *
import ppk.genesis.base_types

def node( type, links_in={}, links_out={}, items=[], tags=[], **params ):
    # мб сделать адаптер для массивов links_in/out,tags чтобы если строка указана то это массив 1 шт
    return {"type":type,"params":params,"items":items,"links_in":links_in,"links_out":links_out,"tags":tags}

