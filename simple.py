import json
import inspect
from enum import Enum

def serialize_to_json(obj):
    """
    Serializes an object to JSON, handling nested objects, Enums, and non-serializable attributes.
    """
    def _serialize(o):
        if o is None or isinstance(o, (str, int, float, bool)):
            return o
        elif isinstance(o, Enum):
            return {
                '__class__': o.__class__.__name__,
                '__enum__': True,
                'name': o.name,
                'value': _serialize(o.value)
            }
        elif isinstance(o, (list, tuple, set)):
            return [_serialize(item) for item in o]
        elif isinstance(o, dict):
            return {key: _serialize(value) for key, value in o.items()}
        else:
            # Handle custom objects
            result = {'__class__': o.__class__.__name__}
            
            # Get all attributes (excluding methods and private attributes)
            attributes = {}
            for name, value in inspect.getmembers(o):
                if not name.startswith('__') and not inspect.ismethod(value):
                    try:
                        attributes[name] = _serialize(value)
                    except TypeError:
                        attributes[name] = str(value)
            
            result['__attributes__'] = attributes
            return result
    
    return json.dumps(_serialize(obj), indent=2)

def reconstruct_from_json(json_str, class_registry=None):
    """
    Reconstructs an object from its JSON representation, with special handling for Enums.
    """
    def _deserialize(d):
        if isinstance(d, dict) and '__class__' in d:
            class_name = d['__class__']
            
            # Handle Enum case
            if d.get('__enum__', False):
                if class_registry and class_name in class_registry:
                    enum_class = class_registry[class_name]
                    return enum_class[d['name']]  # Get enum member by name
                else:
                    # Search in global namespace
                    enum_class = globals().get(class_name)
                    if enum_class is None or not isinstance(enum_class, type(Enum)):
                        raise ValueError(f"Enum class {class_name} not found")
                    return enum_class[d['name']]
            
            # Handle regular class case
            attributes = d.get('__attributes__', {})
            
            # Try to find the class
            cls = None
            if class_registry and class_name in class_registry:
                cls = class_registry[class_name]
            else:
                # Search in global namespace as fallback
                cls = globals().get(class_name)
                if cls is None:
                    raise ValueError(f"Class {class_name} not found in registry or globals")
            
            # Create instance without calling __init__
            obj = cls.__new__(cls)
            
            # Set attributes
            for attr_name, attr_value in attributes.items():
                setattr(obj, attr_name, _deserialize(attr_value))
            
            return obj
        elif isinstance(d, (list, tuple)):
            return [_deserialize(item) for item in d]
        elif isinstance(d, dict):
            return {key: _deserialize(value) for key, value in d.items()}
        else:
            return d
    
    data = json.loads(json_str)
    return _deserialize(data)

class c: 
    arekta  = 9043
    def __init__(self, arekta):
        self.arekta = arekta
class b:
    elem = 343
    cc: c

    def __init__(self, elem,cc):
        self.elem = elem
        self.newelem = cc

class a:
    elem: b
    def __init__(self, elem):
        self.elem = elem

obj = a(b(343,c(9043)))
print(serialize_to_json(obj))
print(reconstruct_from_json(serialize_to_json(obj)))