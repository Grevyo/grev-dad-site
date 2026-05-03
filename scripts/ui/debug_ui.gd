extends CanvasLayer

@export var orbitling_path: NodePath

@onready var debug_label: Label = $PanelContainer/MarginContainer/DebugLabel
var orbitling: Node

func _ready() -> void:
	if orbitling_path != NodePath():
		orbitling = get_node_or_null(orbitling_path)

func _process(_delta: float) -> void:
	if orbitling == null:
		debug_label.text = "Orbitling: not found"
		return

	var stats = orbitling.stats
	debug_label.text = "\n".join([
		"Orbitling Debug",
		"Name: %s" % stats.creature_name,
		"Speed: %.1f" % stats.speed,
		"Bond: %.1f" % stats.bond,
		"Mood: %.1f" % stats.mood,
		"Hunger: %.1f" % stats.hunger,
		"State: %s" % orbitling.state_machine.current_state,
	])
