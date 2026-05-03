extends CharacterBody2D

@export var move_speed: float = 220.0
@export var food_scene: PackedScene
@export var food_container_path: NodePath = NodePath("../FoodContainer")
@export var spawn_distance: float = 28.0

var last_move_direction: Vector2 = Vector2.RIGHT

func _physics_process(_delta: float) -> void:
	# Get keyboard input from custom input actions set in project.godot.
	var move_input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if move_input.length() > 0.01:
		last_move_direction = move_input.normalized()
	velocity = move_input * move_speed
	move_and_slide()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("spawn_food"):
		_spawn_food()

func _spawn_food() -> void:
	if food_scene == null:
		return
	var container := get_node_or_null(food_container_path)
	if container == null:
		return
	var food = food_scene.instantiate()
	food.global_position = global_position + (last_move_direction * spawn_distance)
	container.add_child(food)
