extends Node2D

@export var stats: CreatureStats = CreatureStats.new()
@export var wander_radius: float = 180.0
@export var reaction_distance: float = 120.0
@export var idle_pause_min: float = 0.6
@export var idle_pause_max: float = 1.6
@export var hunger_increase_per_second: float = 2.5
@export var hunger_seek_threshold: float = 45.0
@export var food_detect_radius: float = 220.0
@export var eat_distance: float = 12.0
@export var eat_time_seconds: float = 0.65
@export var follow_player_bond_threshold: float = 85.0

var state_machine: CreatureStateMachine = CreatureStateMachine.new()
var player: Node2D
var home_position: Vector2
var wander_target: Vector2
var idle_timer: float = 0.0
var eat_timer: float = 0.0
var target_food: Node2D

@onready var body: Node2D = $Body

func _ready() -> void:
	randomize()
	home_position = global_position
	player = get_parent().get_node_or_null("Player")
	state_machine.set_state("Wander")
	_choose_new_wander_target()

func set_player(player_node: Node2D) -> void:
	player = player_node

func _process(delta: float) -> void:
	_increase_hunger(delta)

	if player and global_position.distance_to(player.global_position) <= reaction_distance and state_machine.current_state != "Eat":
		state_machine.set_state("ReactToPlayer")
		_look_at_player()
		return

	if stats.bond >= follow_player_bond_threshold:
		state_machine.set_state("FollowPlayer")
		_look_at_player()
		return

	if _should_seek_food():
		_run_seek_food(delta)
		return

	_run_wander(delta)

func _increase_hunger(delta: float) -> void:
	stats.hunger = clamp(stats.hunger + (hunger_increase_per_second * delta), 0.0, 100.0)

func _should_seek_food() -> bool:
	if stats.hunger < hunger_seek_threshold and state_machine.current_state != "SeekFood" and state_machine.current_state != "Eat":
		target_food = null
		return false

	target_food = _find_nearest_food(food_detect_radius)
	return target_food != null

func _run_seek_food(delta: float) -> void:
	if target_food == null or not is_instance_valid(target_food):
		target_food = null
		state_machine.set_state("Wander")
		return

	var to_food := target_food.global_position - global_position
	if to_food.length() <= eat_distance:
		state_machine.set_state("Eat")
		eat_timer = eat_time_seconds
		return

	state_machine.set_state("SeekFood")
	global_position += to_food.normalized() * stats.speed * delta
	body.rotation = to_food.angle()

func _run_wander(delta: float) -> void:
	if state_machine.current_state != "Wander":
		state_machine.set_state("Wander")

	if idle_timer > 0.0:
		idle_timer -= delta
		return

	_move_toward_target(delta)

func _move_toward_target(delta: float) -> void:
	var to_target := wander_target - global_position
	if to_target.length() < 6.0:
		idle_timer = randf_range(idle_pause_min, idle_pause_max)
		_choose_new_wander_target()
		return
	global_position += to_target.normalized() * stats.speed * delta
	body.rotation = to_target.angle()

func _look_at_player() -> void:
	if player == null:
		return
	var to_player := player.global_position - global_position
	if to_player.length() > 0.01:
		body.rotation = to_player.angle()

func _choose_new_wander_target() -> void:
	var angle := randf_range(0.0, TAU)
	var distance := randf_range(20.0, wander_radius)
	wander_target = home_position + Vector2.RIGHT.rotated(angle) * distance

func _find_nearest_food(radius: float) -> Node2D:
	var nearest_food: Node2D
	var nearest_distance := radius
	for node in get_tree().get_nodes_in_group("food"):
		if node is Node2D and is_instance_valid(node):
			var distance := global_position.distance_to(node.global_position)
			if distance <= nearest_distance:
				nearest_distance = distance
				nearest_food = node
	return nearest_food

func _physics_process(delta: float) -> void:
	if state_machine.current_state != "Eat":
		return
	if target_food == null or not is_instance_valid(target_food):
		state_machine.set_state("Wander")
		return
	eat_timer -= delta
	if eat_timer > 0.0:
		return
	_apply_food_effects(target_food)
	target_food = null
	state_machine.set_state("Wander")

func _apply_food_effects(food_node: Node2D) -> void:
	var nutrition: float = 15.0
	if food_node.has_method("consume"):
		nutrition = food_node.consume()
	else:
		food_node.queue_free()
	stats.hunger = clamp(stats.hunger - nutrition, 0.0, 100.0)
	stats.mood = clamp(stats.mood + 4.0, 0.0, 100.0)
	stats.bond = clamp(stats.bond + 2.0, 0.0, 100.0)
