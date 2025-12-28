# Component Logic Examples

This directory demonstrates Phase 4.3 Component Logic features:

## Examples

### `computed.zph`
**Computed Properties** - Shows `$computed()` that auto-updates when dependencies change.

```zph
const fullName = $computed(() => firstName + ' ' + lastName)
```

### `lifecycle.zph`
**Lifecycle Hooks** - Demonstrates `onMount()`, `onDestroy()`, and `onUpdate()`.

```zph
onMount(() => {
  console.log('Component ready!')
})
```

### `store-demo.zph` + `stores/user.zph`
**Store Components** - Global state management with `<store>` tag.

```zph
<!-- stores/user.zph -->
<store>
  let user = $({ name: '', loggedIn: false })
  function login(name) { user = { name, loggedIn: true } }
</store>
```

### `events-demo.zph` + `color-picker.zph`
**Event System** - Parent-child communication with `emit()` and `@event`.

```zph
<!-- Child emits -->
emit('colorChange', { color: '#ff0000' })

<!-- Parent listens -->
<ColorPicker @colorChange="handleColorChange" />
```

## Running

```bash
cd examples/component-logic
zephyr dev
```
