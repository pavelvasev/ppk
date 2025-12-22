import os
import sys

import grafix.genesis as gen

class scene:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()  
        self.rapi = rapi
        self.gui_attached_ch_m = rapi.channel("gui_attached")
        self.gui_attached_ch_m.react( self.on_gui_attached_m )
        #self.gui_attached_ch = rapi.channel("gui_attached_obj")
        #self.gui_attached_ch.react( self.on_gui_attached )

        self.bgcolor = rapi.channel(self.id + 'bgcolor').cell().put([0,0,0.01])

        gen.apply_description( rapi, self, description )

    def on_gui_attached_m(self,msg):
        gui_id = msg["id"]
        gui_ch = self.rapi.channel(gui_id)
        #print("~~~~~~~~~~~~1",gui_id)
        #self.gui_attached_ch.put( gui_ch )
        #def on_gui_attached(self,gui_ch):
        print("=====> scene 1",gui_ch)
        m = {"description":{"type":"view","links_in":
           {"bgcolor":[self.bgcolor.id]},
           "id":"scene","items":[]},"target_id":"root"}
        gui_ch.put( m )

class axes:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        self.rapi = rapi
        self.gui_attached_ch_m = rapi.channel("gui_attached")
        self.gui_attached_ch_m.react( self.on_gui_attached )
        # todo react
        self.size = rapi.channel(self.id + 'size').cell().put(10)

        gen.apply_description( rapi, self, description )

    def on_gui_attached(self,msg):
        self.gui_ch = self.rapi.channel(msg["id"])
        m = {"description":{
              "type":"lines",
              "params": {
                "positions":[0,0,0, 10,0,0, 0,0,0, 0,10,0, 0,0,0, 0,0,10 ],
                "colors":[1,0,0, 1,0,0, 0,1,0, 0,1,0, 0,0,1, 0,0,1 ],
                "radius":2
              }},
              "target_id":"scene"} # todo или к паренту?        
        self.gui_ch.put( m )

class lines:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        self.rapi = rapi
        self.positions = rapi.channel(self.id + 'positions').cell()
        self.color = rapi.channel(self.id + 'color').cell()
        self.colors = rapi.channel(self.id + 'colors').cell()
        self.radius = rapi.channel(self.id + 'radius').cell()
        self.visible = rapi.channel(self.id + 'visible').cell()
        self.gui_attached_ch_m = rapi.channel("gui_attached")
        self.gui_attached_ch_m.react( self.on_gui_attached )
        
        #parent.gui_attached_ch.react( self.on_gui_attached )

        gen.apply_description( rapi, self, description )

    def on_gui_attached(self,msg):
        #print('lines: gui_attached',msg)
        self.gui_ch = self.rapi.channel(msg["id"])
        m = {"description":{
              "type":"lines",              
              "links_in": {
                "positions":[self.positions.id],
                "color":[self.color.id],
                "colors":[self.colors.id],
                "radius":[self.radius.id],
                "visible":[self.visible.id]
                }
              },
              "target_id":"scene"} # todo или к паренту?        
        self.gui_ch.put( m )                    

class points:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        self.rapi = rapi
        self.positions = rapi.channel(self.id + 'positions').cell()
        self.radius = rapi.channel(self.id + 'radius').cell()
        self.color = rapi.channel(self.id + 'color').cell()
        self.visible = rapi.channel(self.id + 'visible').cell()
        self.gui_attached_ch_m = rapi.channel("gui_attached")
        self.gui_attached_ch_m.react( self.on_gui_attached )

        gen.apply_description( rapi, self, description )

    def on_gui_attached(self,msg):
        self.gui_ch = self.rapi.channel(msg["id"])
        #print("=====> lines",gui_ch)
        #print("LINES: on_gui_attached gui_ch=",gui_ch)
        m = {"description":{
              "type":"points",              
              "links_in": {
                "positions":[self.positions.id],
                "radius":[self.radius.id],
                "color":[self.color.id],
                "visible":[self.visible.id]
                }
              },
              "target_id":"scene"} # todo или к паренту?        
        self.gui_ch.put( m )     

class mesh:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        self.rapi = rapi
        self.positions = rapi.channel(self.id + 'positions').cell()
        # а не модификатор ли ты?
        self.color = rapi.channel(self.id + 'color').cell()
        self.opacity = rapi.channel(self.id + 'opacity').cell()
        self.colors = rapi.channel(self.id + 'colors').cell()
        self.visible = rapi.channel(self.id + 'visible').cell()

        self.gui_attached_ch_m = rapi.channel("gui_attached")
        self.gui_attached_ch_m.react( self.on_gui_attached )

        gen.apply_description( rapi, self, description )

    def on_gui_attached(self,msg):
        self.gui_ch = self.rapi.channel(msg["id"])
        #print("=====> lines",gui_ch)
        #print("LINES: on_gui_attached gui_ch=",gui_ch)
        m = {"description":{
              "type":"mesh",
              "links_in": {
                "positions":[self.positions.id],
                "color":[self.color.id],
                "opacity":[self.opacity.id],
                "colors":[self.colors.id],
                "visible":[self.visible.id]
               }
              },
              "target_id":"scene"} # todo или к паренту?        
        self.gui_ch.put( m )

# todo: cubes!
class cube:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        self.rapi = rapi
        # а не модификатор ли ты?
        self.color = rapi.channel(self.id + 'color').cell()

        self.gui_attached_ch_m = rapi.channel("gui_attached")
        self.gui_attached_ch_m.react( self.on_gui_attached )

        gen.apply_description( rapi, self, description )

    def on_gui_attached(self,msg):
        self.gui_ch = self.rapi.channel(msg["id"])
        #print("=====> lines",gui_ch)
        #print("LINES: on_gui_attached gui_ch=",gui_ch)
        m = {"description":{
              "type":"cube",
              "links_in": {
                "color":[self.color.id]
               }
              },
              "target_id":"scene"} # todo или к паренту?        
        self.gui_ch.put( m )

class camera:
    def __init__(self,rapi,description,parent):
        self.id = gen.id_generator()        
        self.rapi = rapi
        # а не модификатор ли ты?
        self.position = rapi.channel(self.id + 'position').cell()
        self.lookat = rapi.channel(self.id + 'lookat').cell()

        self.gui_attached_ch_m = rapi.channel("gui_attached")
        self.gui_attached_ch_m.react( self.on_gui_attached )

        gen.apply_description( rapi, self, description )

    def on_gui_attached(self,msg):
        self.gui_ch = self.rapi.channel(msg["id"])
        m = {"description":{
              "type":"camera",
              "links_in": {
                "position":[self.position.id],
                "lookat":[self.lookat.id]
               }
              },
              "target_id":"scene"} # todo или к паренту?        
        self.gui_ch.put( m )

def init(*args):
    gen.register({"scene":scene})
    gen.register({"axes":axes})
    gen.register({"lines":lines})
    gen.register({"points":points})
    gen.register({"mesh":mesh})
    gen.register({"cube":cube})
    gen.register({"camera":camera})
