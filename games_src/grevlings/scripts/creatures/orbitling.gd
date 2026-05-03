extends Node2D

const STATE_WANDER := "Wander"
const STATE_REACT_TO_PLAYER := "ReactToPlayer"
const STATE_SEEK_FOOD := "SeekFood"
const STATE_EAT := "Eat"

@export var stats: CreatureStats = CreatureStats.new()
@export var wander_radius: float = 180.0
@export var reaction_distance: float = 130.0
@export var food_detection_radius: float = 180.0
@export var eat_distance: float = 12.0
@export var idle_pause_min: float = 0.4
@export var idle_pause_max: float = 1.2

var current_state: String = STATE_WANDER
var player: Node2D
var home_position: Vector2
var wander_target: Vector2
var idle_timer: float = 0.0
var target_food: Food

@onready var body: Node2D = $Body

func _ready() -> void:
	home_position = global_position
	_choose_new_wander_target()

func set_player(player_node: Node2D) -> void:
	player = player_node

func _process(delta: float) -> void:
	if target_food == null or not is_instance_valid(target_food):
		target_food = _find_nearest_food()

	if target_food != null:
		_seek_or_eat_food(delta)
		return

	if _is_player_nearby():
		current_state = STATE_REACT_TO_PLAYER
		_look_toward_player()
		return

	current_state = STATE_WANDER
	_run_wander(delta)

func _find_nearest_food() -> Food:
	var nearest_food: Food
	var nearest_distance := food_detection_radius
	for food_node in get_tree().get_nodes_in_group("food"):
		if food_node is Food and is_instance_valid(food_node):
			var distance := global_position.distance_to(food_node.global_position)
			if distance <= nearest_distance:
				nearest_distance = distance
				nearest_food = food_node
	return nearest_food

func _seek_or_eat_food(delta: float) -> void:
	if target_food == null or not is_instance_valid(target_food):
		target_food = null
		current_state = STATE_WANDER
		return

	var to_food := target_food.global_position - global_position
	if to_food.length() <= eat_distance:
		current_state = STATE_EAT
		var nutrition := target_food.consume()
		target_food = null
		stats.hunger = clamp(stats.hunger - nutrition, 0.0, 100.0)
		stats.mood = clamp(stats.mood + 6.0, 0.0, 100.0)
		stats.bond = clamp(stats.bond + 1.5, 0.0, 100.0)
		return

	current_state = STATE_SEEK_FOOD
	global_position += to_food.normalized() * stats.speed * delta
	body.rotation = to_food.angle()

func _is_player_nearby() -> bool:
	return player != null and global_position.distance_to(player.global_position) <= reaction_distance

func _run_wander(delta: float) -> void:
	if idle_timer > 0.0:
		idle_timer -= delta
		return

	var to_target := wander_target - global_position
	if to_target.length() < 6.0:
		idle_timer = randf_range(idle_pause_min, idle_pause_max)
		_choose_new_wander_target()
		return

	global_position += to_target.normalized() * stats.speed * delta
	body.rotation = to_target.angle()

func _look_toward_player() -> void:
	var to_player := player.global_position - global_position
	if to_player.length() > 0.01:
		body.rotation = to_player.angle()

func _choose_new_wander_target() -> void:
	var angle := randf_range(0.0, TAU)
	var distance := randf_range(24.0, wander_radius)
	wander_target = home_position + Vector2.RIGHT.rotated(angle) * distance
