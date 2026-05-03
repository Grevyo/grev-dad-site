extends Node

@export var orbitling_path: NodePath
@export var debug_ui_path: NodePath
@export var autosave_interval_seconds: float = 30.0
@export var manual_save_action: StringName = &"debug_save"
@export var manual_load_action: StringName = &"debug_load"

const SAVE_FILE_PATH := "user://orbitling_save.json"

var orbitling: Node2D
var debug_ui: Node
var autosave_timer: float = 0.0

func _ready() -> void:
	orbitling = get_node_or_null(orbitling_path)
	debug_ui = get_node_or_null(debug_ui_path)
	_ensure_debug_actions_exist()
	load_orbitling()

func _process(delta: float) -> void:
	autosave_timer += delta
	if autosave_timer >= autosave_interval_seconds:
		autosave_timer = 0.0
		save_orbitling("Autosaved Orbitling")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(manual_save_action):
		save_orbitling("Manual save complete")
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed(manual_load_action):
		load_orbitling("Manual load complete")
		get_viewport().set_input_as_handled()

func save_orbitling(status_message: String = "Save complete") -> void:
	if orbitling == null:
		_set_status("Save skipped: Orbitling not found")
		return

	var stats = orbitling.stats
	var payload := {
		"name": stats.creature_name,
		"speed": stats.speed,
		"bond": stats.bond,
		"mood": stats.mood,
		"hunger": stats.hunger,
		"position": {
			"x": orbitling.global_position.x,
			"y": orbitling.global_position.y,
		},
	}

	var save_file := FileAccess.open(SAVE_FILE_PATH, FileAccess.WRITE)
	if save_file == null:
		_set_status("Save failed: could not open %s" % SAVE_FILE_PATH)
		return

	save_file.store_string(JSON.stringify(payload, "\t"))
	save_file.close()
	_set_status("%s (%s)" % [status_message, SAVE_FILE_PATH])

func load_orbitling(status_message: String = "Loaded Orbitling save") -> void:
	if orbitling == null:
		_set_status("Load skipped: Orbitling not found")
		return

	if not FileAccess.file_exists(SAVE_FILE_PATH):
		_set_status("No save file at %s" % SAVE_FILE_PATH)
		return

	var save_file := FileAccess.open(SAVE_FILE_PATH, FileAccess.READ)
	if save_file == null:
		_set_status("Load failed: could not open %s" % SAVE_FILE_PATH)
		return

	var raw_text := save_file.get_as_text()
	save_file.close()
	var parsed = JSON.parse_string(raw_text)
	if typeof(parsed) != TYPE_DICTIONARY:
		_set_status("Load failed: invalid JSON")
		return

	_apply_loaded_data(parsed)
	_set_status("%s (%s)" % [status_message, SAVE_FILE_PATH])

func _apply_loaded_data(data: Dictionary) -> void:
	var stats = orbitling.stats
	stats.creature_name = str(data.get("name", stats.creature_name))
	stats.speed = float(data.get("speed", stats.speed))
	stats.bond = clamp(float(data.get("bond", stats.bond)), 0.0, 100.0)
	stats.mood = clamp(float(data.get("mood", stats.mood)), 0.0, 100.0)
	stats.hunger = clamp(float(data.get("hunger", stats.hunger)), 0.0, 100.0)

	var position_data = data.get("position", {})
	if position_data is Dictionary:
		var x := float(position_data.get("x", orbitling.global_position.x))
		var y := float(position_data.get("y", orbitling.global_position.y))
		orbitling.global_position = Vector2(x, y)
		if orbitling.has_variable("home_position"):
			orbitling.home_position = orbitling.global_position

func _set_status(message: String) -> void:
	if debug_ui and debug_ui.has_method("set_status_message"):
		debug_ui.set_status_message(message)

func _ensure_debug_actions_exist() -> void:
	_ensure_action(manual_save_action, KEY_F5)
	_ensure_action(manual_load_action, KEY_F9)

func _ensure_action(action_name: StringName, keycode: Key) -> void:
	if not InputMap.has_action(action_name):
		InputMap.add_action(action_name)

	if _action_has_key(action_name, keycode):
		return

	var event := InputEventKey.new()
	event.physical_keycode = keycode
	InputMap.action_add_event(action_name, event)

func _action_has_key(action_name: StringName, keycode: Key) -> bool:
	for event in InputMap.action_get_events(action_name):
		if event is InputEventKey and event.physical_keycode == keycode:
			return true
	return false
