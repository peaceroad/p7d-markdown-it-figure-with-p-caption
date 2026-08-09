const copyDiagnosticMap = (map) => (
  Array.isArray(map)
  && map.length === 2
  && Number.isSafeInteger(map[0])
  && Number.isSafeInteger(map[1])
  && map[0] >= 0
  && map[1] >= map[0]
    ? [map[0], map[1]]
    : null
)

export const resetFigureNotesDiagnostics = (env) => {
  if (Array.isArray(env?.figureNotesDiagnostics)) {
    env.figureNotesDiagnostics.length = 0
  }
}

export const pushFigureNotesDiagnostic = (env, code, map = null, details = null) => {
  if (!env) return
  const diagnostics = Array.isArray(env.figureNotesDiagnostics)
    ? env.figureNotesDiagnostics
    : (env.figureNotesDiagnostics = [])
  diagnostics.push({
    code,
    map: copyDiagnosticMap(map),
    ...(details || {}),
  })
}
