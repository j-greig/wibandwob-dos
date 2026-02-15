# Proposed Tree Structure

wibwob-dos/
  README.md
  LICENSE
  CHANGELOG.md
  ROADMAP.md
  CONTRIBUTING.md
  CODE_OF_CONDUCT.md
  SECURITY.md

  .github/
    workflows/
      ci.yml
      release.yml
      contract-tests.yml

  docs/
    index.md
    architecture/
      overview.md
      repo-conventions.md
      engine.md
      ui-tvision.md
      adapters.md
      contracts.md
      state-and-replay.md
      events.md
      permissions.md
      instances.md
    guides/
      build.md
      run-local.md
      run-docker.md
      add-command.md
      add-window.md
      add-component.md
      add-sidecar.md
      release.md
    reference/
      cli.md
      api.md
      mcp.md

  planning/
    canvas/
      logging-replay.md
      markdown-browser.md
      generative-ui.md
      multi-agent.md
      hosted-instances.md
    decisions/
      adr-0001-contracts.md
      adr-0002-capabilities.md
      adr-0003-state-authority.md
      adr-0004-instances.md

  skills/
    README.md
    cpp-engine/skill.md
    cpp-tvision/skill.md
    contracts/skill.md
    ipc/skill.md
    api-mcp/skill.md
    cli/skill.md
    release/skill.md

  contracts/                         # canon: versioned interfaces only
    protocol/
      v1/
        capabilities.schema.json
        exec_command.schema.json
        error.schema.json
        health.schema.json
    state/
      v1/
        state.schema.json
        workspace.schema.json
        snapshot.schema.json
    events/
      v1/
        event.schema.json
        stream.schema.json
    ui/
      v1/
        ui_components.schema.json
        render_bundle.schema.json

  src/
    engine/
      Engine.h/.cpp                  # owns state, commands, events, instances
      Instance.h/.cpp
      CommandRegistry.h/.cpp         # command specs + exec
      CapabilityRegistry.h/.cpp      # exports capabilities JSON
      StateStore.h/.cpp              # snapshots/workspaces
      EventBus.h/.cpp                # typed events
      Policy.h/.cpp                  # permissions/limits (optional v1)
    ui/
      tvision/
        App.h/.cpp
        MenuBuilder.h/.cpp           # builds menu from registry categories
        windows/
          TextEditorWindow.*
          TextViewWindow.*
          FramePlayerWindow.*
          BrowserWindow.*            # future
        views/
          TableView.*
          ListView.*
          InspectorView.*
        components/
          UiComponentRenderer.*      # renders “generative UI” spec
    adapters/
      ipc/
        IpcServer.h/.cpp             # Unix socket (or named pipe later)
        IpcProtocol.h/.cpp           # parse/encode base64 json, versioning
      cli/
        main.cpp                     # wibwob CLI (talks to API/MCP)
      headless/
        main.cpp                     # optional: run engine sans TV UI

  tools/
    api_server/                      # python package
      pyproject.toml
      wibwob_api/
        main.py                      # FastAPI + MCP endpoints
        capability_sync.py           # reads /capabilities
        toolgen.py                   # generates MCP tools dynamically
        client_ipc.py
        client_http.py
        validators.py                # validate args against contracts
    sidecars/                        # optional external “apps”
      browser/
        pyproject.toml
        service.py                   # html->md->render_bundle + images
      ansi/
        pyproject.toml
        render_image.py              # chafa/jp2a wrappers

  extensions/                        # disciplined experiments
    README.md
    core/
      module.json
      primers/
      themes/
    lab/
      module.json
      primers/
      experiments/

  runtime/
    instances/                       # default local instance storage
      .gitkeep
    cache/
      .gitkeep
    logs/
      .gitkeep

  scripts/
    dev.sh
    run_local.sh
    run_docker.sh
    format.sh
    release.sh

  tests/
    contract/
      test_contract_roundtrip.py     # capabilities->tools->exec validation
    cpp/
      test_registry.cpp
      test_state_roundtrip.cpp
      test_events.cpp
    fixtures/
      snapshots/
      workspaces/
      bundles/

  third_party/
    tvision/                         # submodule pointer or vendored

  CMakeLists.txt
  cmake/
