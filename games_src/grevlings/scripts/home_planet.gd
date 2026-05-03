extends Node2D

const FOOD_SCENE := preload("res://scenes/food/Food.tscn")

@export var food_drop_distance: float = 26.0

@onready var player: CharacterBody2D = $Player
@onready var orbitling: Node2D = $Orbitling
@onready var debug_ui: CanvasLayer = $DebugUI
@onready var save_system: Node = $SaveSystem

func _ready() -> void:
	if orbitling.has_method("set_player"):
		orbitling.set_player(player)
	if debug_ui.has_method("set_orbitling"):
		debug_ui.set_orbitling(orbitling)
	if debug_ui.has_method("set_scene_mode"):
		debug_ui.set_scene_mode("HomePlanet")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("spawn_food"):
		_spawn_food_near_player()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("start_race"):
		if save_system and save_system.has_method("save_orbitling"):
			save_system.save_orbitling("Saved before Moon Sprint")
		get_tree().change_scene_to_file("res://scenes/events/MoonSprint.tscn")
		get_viewport().set_input_as_handled()

func _spawn_food_near_player() -> void:
	var food := FOOD_SCENE.instantiate()
	var offset := Vector2.RIGHT.rotated(randf_range(0.0, TAU)) * food_drop_distance
	food.global_position = player.global_position + offset
	add_child(food)
	if debug_ui.has_method("set_status_message"):
		debug_ui.set_status_message("Food dropped")
