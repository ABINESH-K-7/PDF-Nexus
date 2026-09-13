export const createId = () => Date.now() + Math.random()

export const findAndUpdate = (nodes, id, cb) =>
  nodes.map(n =>
    n.id === id
      ? cb(n)
      : n.children
      ? { ...n, children: findAndUpdate(n.children, id, cb) }
      : n
  )

export const removeNode = (nodes, id) =>
  nodes
    .filter(n => n.id !== id)
    .map(n =>
      n.children ? { ...n, children: removeNode(n.children, id) } : n
    )
