extends Node2D

@onready var orbitling: Node2D = $HomePlanet/Orbitling
@onready var player: Node2D = $HomePlanet/Player
@onready var debug_ui: CanvasLayer = $HomePlanet/DebugUI

func _ready() -> void:
	if orbitling.has_method("set_player"):
		orbitling.set_player(player)
	if debug_ui.has_method("set_orbitling"):
		debug_ui.set_orbitling(orbitling)
