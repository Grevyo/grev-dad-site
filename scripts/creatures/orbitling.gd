extends Node2D

@export var stats: CreatureStats = CreatureStats.new()
@export var wander_radius: float = 180.0
@export var reaction_distance: float = 120.0
@export var idle_pause_min: float = 0.6
@export var idle_pause_max: float = 1.6

var state_machine: CreatureStateMachine = CreatureStateMachine.new()
var player: Node2D
var home_position: Vector2
var wander_target: Vector2
var idle_timer: float = 0.0

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
	if player and global_position.distance_to(player.global_position) <= reaction_distance:
		state_machine.set_state("React")
		_look_at_player()
		return

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
	var to_player := player.global_position - global_position
	if to_player.length() > 0.01:
		body.rotation = to_player.angle()

func _choose_new_wander_target() -> void:
	var angle := randf_range(0.0, TAU)
	var distance := randf_range(20.0, wander_radius)
	wander_target = home_position + Vector2.RIGHT.rotated(angle) * distance
