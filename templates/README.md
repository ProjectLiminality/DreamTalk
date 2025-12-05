# DreamTalk Templates

Templates for creating DreamNode-compatible DreamTalk symbols and scenes.

## SovereignSymbol Template

A template for creating a **sovereign symbol** — a DreamNode that contains a DreamTalk CustomObject with its source code and rendered output.

### Quick Start

```bash
# 1. Copy the template
cp -r templates/SovereignSymbol ~/path/to/MySymbol

# 2. Initialize as git repo
cd ~/path/to/MySymbol
git init

# 3. Add DreamTalk as submodule
git submodule add <dreamtalk-repo-url> submodules/DreamTalk
git submodule update --init submodules/DreamTalk

# 4. Generate UUID for .udd
python -c "import uuid; print(uuid.uuid4())"
# Update .udd with the generated UUID

# 5. Rename and customize files
mv symbol_name.py my_symbol.py
# Edit my_symbol.py, symbol_scene.py, CLAUDE.md, .udd
```

### Template Structure

```
SovereignSymbol/
├── .udd                    # DreamNode metadata (edit: uuid, title, description)
├── CLAUDE.md               # AI instructions (edit: describe your symbol)
├── symbol_name.py          # CustomObject definition (rename and implement)
├── symbol_scene.py         # Renders the canonical symbol (update imports)
├── dreamtalk_init.py       # Path resolver (do not modify)
├── .gitignore              # Standard ignores
└── renders/
    └── .gitkeep            # Placeholder (delete after first render)
```

### After Customization

1. Implement your CustomObject in `<name>.py`
2. Update `symbol_scene.py` to import and render it
3. Run in Cinema 4D to generate `renders/symbol.gif`
4. Commit and push

### Using as a Submodule

When another DreamNode wants to use your symbol:

```bash
# From the parent repo
git submodule add <your-symbol-url> submodules/MySymbol
git submodule update --init submodules/MySymbol
# Do NOT use --recursive
```

```python
# In parent's code
from dreamtalk_init import init; init()
from MySymbol.my_symbol import MySymbol

class ParentSymbol(CustomObject):
    def specify_parts(self):
        self.child = MySymbol()
        self.parts += [self.child]
```
