class Entity:
    def __init__(self, entity_id):
        self.id = entity_id

class Position:
    def __init__(self, x, y):
        self.x = x
        self.y = y

class Velocity:
    def __init__(self, dx, dy):
        self.dx = dx
        self.dy = dy

class World:
    def __init__(self):
        self.entities = {}
        self.components = {} # Stores components by type, then by entity ID

    def create_entity(self):
        entity_id = len(self.entities) # Simple ID generation
        entity = Entity(entity_id)
        self.entities[entity_id] = entity
        return entity_id

    def add_component(self, entity_id, component):
        component_type = type(component)
        if component_type not in self.components:
            self.components[component_type] = {}
        self.components[component_type][entity_id] = component

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

class MovementSystem:
    def update(self, world, dt):
        for entity_id in world.get_entities_with_components(Position, Velocity):
            pos = world.get_component(entity_id, Position)
            vel = world.get_component(entity_id, Velocity)
            pos.x += vel.dx * dt
            pos.y += vel.dy * dt

# Usage Example:
world = World()
player_id = world.create_entity()
world.add_component(player_id, Position(x=0, y=0))
world.add_component(player_id, Velocity(dx=1, dy=0.5))

enemy_id = world.create_entity()
world.add_component(enemy_id, Position(x=10, y=5))
world.add_component(enemy_id, Velocity(dx=-0.5, dy=0))

movement_system = MovementSystem()

for i in range(10):
    movement_system.update(world, dt=1)
    player_pos = world.get_component(player_id, Position)
    print(i,f"Player new position: ({player_pos.x}, {player_pos.y})")
    player_pos = world.get_component(enemy_id, Position)
    print(i,f"Enemy new position: ({player_pos.x}, {player_pos.y})")    