Interactuar con el Brain Network — la red de inteligencia distribuida del ecosistema.

## Modos

El argumento determina el modo:

- `/brain query <pregunta>` — Buscar conocimiento en toda la red
- `/brain ingest` — Ingestar la sesion actual como nodo de conocimiento
- `/brain lint` — Auditoria de salud del brain
- `/brain stats` — Estadisticas de la red
- `/brain traverse <slug>` — Navegar el grafo desde un nodo
- `/brain promote` — Promover conceptos emergentes cross-app
- `/brain consolidate` — Limpiar nodos viejos y huerfanos
- `/brain conflicts` — Detectar info contradictoria entre apps
- `/brain register <app_id> <brain_dir>` — Registrar un nuevo app brain

## Modo: query (default)

Busca en el Mother Brain + todos los app brains registrados.

1. Ejecutar busqueda en la red con el argumento como query:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
results = network.query_network("<ARGUMENTO>", limit=10)
```

2. Presentar resultados al usuario con formato:
   - Brain de origen
   - Titulo y tipo del nodo
   - Contexto resumido (primeras 200 chars)
   - Tags y fecha
   - Score de relevancia y frescura

## Modo: ingest

Ingesta conocimiento de la sesion actual.

1. Revisar `git diff` y `git status` para entender que se hizo
2. Generar titulo descriptivo del conocimiento
3. Determinar area (dev, ops, ux, business, security, etc.)
4. Extraer tags relevantes de los cambios
5. Crear nodo via:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
node = network.mother.ingest(
    title="<titulo>",
    context="<que se hizo y por que>",
    decisions="<decisiones tomadas>",
    output="<resultados concretos>",
    area="<area>",
    tags=["<tags>"],
    node_type="session",
    importance="<critical|high|normal|low>",
)
```

6. Reportar al usuario el slug creado y sus cross-refs detectadas

## Modo: lint

1. Ejecutar lint de toda la red:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
report = network.lint_network()
```

2. Presentar: score global, issues por brain, conceptos emergentes
3. Si hay issues criticos, sugerir acciones correctivas

## Modo: stats

1. Obtener estadisticas de la red:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
stats = network.network_stats()
```

2. Presentar: total de brains, nodos, conexiones, apps registradas, top tags

## Modo: traverse

1. Navegar el grafo desde un nodo:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
neighborhood = network.mother.get_neighborhood("<ARGUMENTO>", depth=3)
```

2. Presentar: nodo central, vecinos por nivel de profundidad, total alcanzable

## Modo: promote

1. Promover conceptos emergentes:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
promoted = network.promote_concepts()
```

2. Reportar conceptos promovidos con sus apps de origen

## Modo: consolidate

1. Consolidar memoria de toda la red:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
report = network.consolidate_network(min_age_days=30)
```

2. Reportar nodos archivados por brain

## Modo: conflicts

1. Detectar conflictos:

```python
import sys; sys.path.insert(0, '.agent')
from core.brain_network import BrainNetwork
from pathlib import Path
network = BrainNetwork(Path('.'))
conflicts = network.detect_conflicts()
```

2. Presentar: nodos en conflicto, apps involucradas, sugerencia de resolucion

## Modo: register

1. Registrar app brain con argumento formato `<app_id> <brain_dir>`
2. Confirmar registro y mostrar estado de la red

## Reglas

- Responder en espanol
- Si no se especifica modo, asumir `query` con el argumento como pregunta
- Si no hay argumento, mostrar stats de la red
