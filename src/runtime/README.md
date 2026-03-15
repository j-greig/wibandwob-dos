# `src/runtime`

Stateful host runtime ownership for a single Runtime Node.

This layer should own:

- instance-scoped runtime state
- command and event dispatch core
- window/focus/runtime containers
- lifecycle plumbing

It should not become a duplicate of existing `src/core` immediately. Move code here only when ownership is clear.
