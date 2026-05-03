extends Node2D

const EventParticipant = preload("res://scripts/events/event_participant.gd")
const SAVE_FILE_PATH := "user://orbitling_save.json"

@onready var participants_root: Node2D = $Participants
@onready var start_line: Node2D = $Track/StartLine
@onready var finish_line: Node2D = $Track/FinishLine
@onready var race_controller: RaceController = $RaceController
@onready var status_label: Label = $UI/PanelContainer/MarginContainer/VBoxContainer/StatusLabel
@onready var finish_order_label: Label = $UI/PanelContainer/MarginContainer/VBoxContainer/FinishOrderLabel
@onready var return_button: Button = $UI/PanelContainer/MarginContainer/VBoxContainer/ReturnButton

var participant_slots: Array[EventParticipant] = []

func _ready() -> void:
	_setup_participant_slots()
	race_controller.setup_race(participant_slots, finish_line.global_position.x)
	race_controller.race_finished.connect(_on_race_finished)
	return_button.pressed.connect(_return_to_home_planet)
	status_label.text = "Moon Sprint in progress..."
	finish_order_label.text = ""

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("return_home") or event.is_action_pressed("ui_cancel"):
		_return_to_home_planet()

func _setup_participant_slots() -> void:
	participant_slots.clear()
	var local_data := _load_local_orbitling_data()
	var slot_definitions := [
		{"type": EventParticipant.ParticipantType.LOCAL_PLAYER_CREATURE, "name": local_data["name"], "speed": local_data["speed"], "color": Color(0.4, 0.9, 1.0, 1.0)},
		{"type": EventParticipant.ParticipantType.CPU_CREATURE, "name": "Slot 2 - CPU A", "speed": 88.0, "color": Color(1.0, 0.7, 0.3, 1.0)},
		{"type": EventParticipant.ParticipantType.CPU_CREATURE, "name": "Slot 3 - CPU B", "speed": 92.0, "color": Color(1.0, 0.5, 0.5, 1.0)},
		{"type": EventParticipant.ParticipantType.CPU_CREATURE, "name": "Slot 4 - CPU C", "speed": 85.0, "color": Color(0.7, 1.0, 0.6, 1.0)},
	]

	for i in range(slot_definitions.size()):
		var creature := _create_placeholder_creature(slot_definitions[i]["color"])
		creature.global_position = Vector2(start_line.global_position.x - 18.0, start_line.global_position.y + (i * 70.0))
		participants_root.add_child(creature)

		var participant := EventParticipant.new(i + 1, slot_definitions[i]["type"], slot_definitions[i]["name"], slot_definitions[i]["speed"], creature)
		participant_slots.append(participant)

func _create_placeholder_creature(color: Color) -> Node2D:
	var node := Node2D.new()
	var body := Polygon2D.new()
	body.color = color
	body.polygon = PackedVector2Array([-14, -10], [10, -10], [16, 0], [10, 10], [-14, 10], [-18, 0])
	node.add_child(body)
	return node

func _on_race_finished(finish_order: Array[EventParticipant]) -> void:
	status_label.text = "Moon Sprint complete!"
	var lines: PackedStringArray = []
	for participant in finish_order:
		lines.append("%d. %s" % [participant.finish_rank, participant.display_name])
	finish_order_label.text = "Finish Order\n" + "\n".join(lines)

func _load_local_orbitling_data() -> Dictionary:
	var fallback := {"name": "Slot 1 - Local", "speed": 95.0}
	if not FileAccess.file_exists(SAVE_FILE_PATH):
		return fallback
	var save_file := FileAccess.open(SAVE_FILE_PATH, FileAccess.READ)
	if save_file == null:
		return fallback
	var parsed = JSON.parse_string(save_file.get_as_text())
	save_file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return fallback
	return {
		"name": str(parsed.get("name", fallback["name"])),
		"speed": float(parsed.get("speed", fallback["speed"])),
	}

func _return_to_home_planet() -> void:
	get_tree().change_scene_to_file("res://scenes/home/HomePlanet.tscn")
