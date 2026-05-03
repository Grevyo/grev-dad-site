extends Resource
class_name CreatureStats

@export var creature_name: String = "Orbitling"
@export var speed: float = 90.0
@export_range(0.0, 100.0) var bond: float = 25.0
@export_range(0.0, 100.0) var mood: float = 65.0
@export_range(0.0, 100.0) var hunger: float = 30.0
