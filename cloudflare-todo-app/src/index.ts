import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  TODOS_KV: KVNamespace
}

type Todo = {
  id: string
  text: string
  done: boolean
  createdAt: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

app.get('/', (c) => c.html(HTML))

app.get('/api/todos', async (c) => {
  const data = await c.env.TODOS_KV.get('todos')
  const todos: Todo[] = data ? JSON.parse(data) : []
  return c.json(todos)
})

app.post('/api/todos', async (c) => {
  const { text } = await c.req.json<{ text: string }>()
  const data = await c.env.TODOS_KV.get('todos')
  const todos: Todo[] = data ? JSON.parse(data) : []
  const todo: Todo = {
    id: crypto.randomUUID(),
    text: text.trim(),
    done: false,
    createdAt: new Date().toISOString(),
  }
  todos.push(todo)
  await c.env.TODOS_KV.put('todos', JSON.stringify(todos))
  return c.json(todo, 201)
})

app.patch('/api/todos/:id', async (c) => {
  const id = c.req.param('id')
  const data = await c.env.TODOS_KV.get('todos')
  const todos: Todo[] = data ? JSON.parse(data) : []
  const todo = todos.find((t) => t.id === id)
  if (!todo) return c.json({ error: 'Not found' }, 404)
  todo.done = !todo.done
  await c.env.TODOS_KV.put('todos', JSON.stringify(todos))
  return c.json(todo)
})

app.delete('/api/todos/:id', async (c) => {
  const id = c.req.param('id')
  const data = await c.env.TODOS_KV.get('todos')
  let todos: Todo[] = data ? JSON.parse(data) : []
  todos = todos.filter((t) => t.id !== id)
  await c.env.TODOS_KV.put('todos', JSON.stringify(todos))
  return c.json({ ok: true })
})

const HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Todo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 48px auto; padding: 0 16px; color: #1a1a1a; }
    h1 { font-size: 1.6rem; margin-bottom: 24px; }
    .input-row { display: flex; gap: 8px; margin-bottom: 24px; }
    input[type="text"] { flex: 1; padding: 9px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
    input[type="text"]:focus { outline: none; border-color: #2563eb; }
    .btn-add { padding: 9px 18px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
    .btn-add:hover { background: #1d4ed8; }
    .todo-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .todo-text { flex: 1; font-size: 1rem; }
    .todo-text.done { text-decoration: line-through; color: #aaa; }
    .btn-del { background: none; border: none; color: #ccc; font-size: 1.3rem; cursor: pointer; padding: 0 4px; line-height: 1; }
    .btn-del:hover { color: #e53e3e; }
    .empty { text-align: center; color: #bbb; padding: 40px 0; }
  </style>
</head>
<body>
  <h1>Todo</h1>
  <div class="input-row">
    <input id="input" type="text" placeholder="新しいタスクを入力..." />
    <button class="btn-add" onclick="addTodo()">追加</button>
  </div>
  <div id="list"></div>
  <script>
    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    async function load() {
      const res = await fetch('/api/todos')
      const todos = await res.json()
      const list = document.getElementById('list')
      if (!todos.length) {
        list.innerHTML = '<p class="empty">タスクがありません</p>'
        return
      }
      list.innerHTML = todos.map(t => \`
        <div class="todo-item">
          <input type="checkbox" \${t.done ? 'checked' : ''} onchange="toggle('\${t.id}')" />
          <span class="todo-text \${t.done ? 'done' : ''}">\${esc(t.text)}</span>
          <button class="btn-del" onclick="del('\${t.id}')">×</button>
        </div>
      \`).join('')
    }

    async function addTodo() {
      const input = document.getElementById('input')
      const text = input.value.trim()
      if (!text) return
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      input.value = ''
      load()
    }

    async function toggle(id) {
      await fetch('/api/todos/' + id, { method: 'PATCH' })
      load()
    }

    async function del(id) {
      await fetch('/api/todos/' + id, { method: 'DELETE' })
      load()
    }

    document.getElementById('input').addEventListener('keydown', e => {
      if (e.key === 'Enter') addTodo()
    })

    load()
  </script>
</body>
</html>`

export default app
