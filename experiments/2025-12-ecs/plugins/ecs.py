import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

class Entity:
    def __init__(self, entity_id):
        self.id = entity_id

class World:
    def __init__(self):
        self.entities = {}
        self.components = {} # Stores components by type, then by entity ID

    def create_entity(self,entity_id):
        #entity_id = len(self.entities) # Simple ID generation
        entity = Entity(entity_id)
        self.entities[entity_id] = entity
        return entity_id

    def add_component(self, entity_id, component_type, component):
        #component_type = type(component)
        if component_type not in self.components:
            self.components[component_type] = {}
        self.components[component_type][entity_id] = component

    def remove_component(self, entity_id, component_type):
        del self.components[component_type][entity_id]

    def get_component(self, entity_id, component_type):
        return self.components.get(component_type, {}).get(entity_id)

    def get_entities_with_components(self, *component_types):
        # Returns entity IDs that have all specified component types
        if not component_types:
            return self.entities.keys()

        first_component_entities = set(self.components.get(component_types[0], {}).keys())
        
        if not first_component_entities:
            return set()

        for comp_type in component_types[1:]:
            current_component_entities = set(self.components.get(comp_type, {}).keys())
            first_component_entities.intersection_update(current_component_entities)
            if not first_component_entities:
                break # Optimization: if intersection becomes empty, no need to continue

        return first_component_entities

class LoopComponent:
    """
    Компонента, которая запускает вечный цикл в отдельной задаче.
    """
    
    def __init__(self):        
        self._running = False
        # Создаем и запускаем задачу
        self._task = asyncio.create_task(self._run_loop())
    
    async def _run_loop(self):
        """Вечный цикл работы компоненты."""
        self._running = True
        iteration = 0
        
        try:
            while self._running:
                # Здесь ваша логика работы
                iteration += 1
                print(f"Итерация {iteration} len(LOCAL_SYSTEMS)=",len(LOCAL_SYSTEMS))
                for s in LOCAL_SYSTEMS:
                    s.process_ecs( iteration, LOCAL_WORLD )

                # Передаем управление event loop'у
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            print("Задача была отменена")
            raise
        finally:
            print("Цикл завершен")
    
    async def stop(self):
        """Остановка компоненты."""
        if self._task and not self._task.done():
            self._running = False
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    def is_running(self) -> bool:
        """Проверка, работает ли компонента."""
        return self._running and self._task and not self._task.done()


class entity:
    def __init__(self,rapi,description,parent):
        self.rapi = rapi
        self.id = description["params"]["entity_id"]
        self.entity_id = self.id # ну тоже закопируют
        #gen.id_generator()        
        self.update_component_channel = rapi.channel(self.id)
        self.components = dict()

        # исходящие сигналы при обновлении компонент
        self.component_channels = dict()

        LOCAL_WORLD.create_entity( self.id )

        #self.output = ppk.local.Channel()
        #self.result = ppk.local.Channel() # итого
        #self.input = ppk.local.Channel()
        #self.n = ppk.local.Cell()
        #self.cnt = 0

        def on_update_component(v):
            component_name  = v["component_name"]
            self.update_component(component_name,v)

        self.update_component_channel.react( on_update_component )

        # внедряем присланные компоненты
        if "components" in description["params"]:
            for cname,cvalue in description["params"]["components"].items():
                cvalue["component_name"] = cname
                on_update_component( cvalue )

        print("ecs-entity item created")

        gen.apply_description( rapi, self, description )

    def remove_component( self, component_name ):
        del self.components[ component_name ]
        LOCAL_WORLD.remove_component( self.id,component_name)

    def update_component( self,component_name, component_value ):
        self.components[ component_name ] = component_value

        LOCAL_WORLD.add_component( self.id,component_name, component_value )

        if not component_name in self.component_channels:
            c = self.rapi.channel(f"{self.id}_{component_name}")
            self.component_channels[component_name] = c

        # и теперь послать сигнал
        self.component_channels[component_name].put( component_value )
        

        #component_name  = v["component_name"]
        #component_value = v["component_value"]
        #if "payload" in v:
        #    component_value["data"] = v["payload"]                    

# что ето
"""
class simulation:
    def __init__(self,rapi,description,parent):
        print("simulation item created")
        gen.apply_description( rapi, self, description )
"""        

################

LOCAL_WORLD = World()
LOCAL_SYSTEMS = []
ECS_PROCESSOR = None

import builtins
builtins.LOCAL_SYSTEMS = LOCAL_SYSTEMS

################

def init(*args):
    gen.register({"entity":entity})    
    #gen.register({"simulation":simulation})    
    #nonlocal ECS_PROCESSOR
    ECS_PROCESSOR = LoopComponent()