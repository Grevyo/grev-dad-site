extends Resource
class_name CreatureStats

@export var creature_name: String = "Orbitling"
@export var speed: float = 85.0
@export_range(0.0, 100.0) var bond: float = 20.0
@export_range(0.0, 100.0) var mood: float = 60.0
@export_range(0.0, 100.0) var hunger: float = 40.0
