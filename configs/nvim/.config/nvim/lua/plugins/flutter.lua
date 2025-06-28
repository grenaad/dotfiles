return {
  "akinsho/flutter-tools.nvim",
  opts = {
    lsp = {
      settings = {
        enablesnippets = true,
      },
    },
  },
  specs = {
    {
      "AstroNvim/astrocore",
      opts = {
        mappings = {
          n = {
            ["<Leader>F"] = { desc = "Flutter" },
            ["<Leader>Fc"] = {
              function()
                require("telescope").extensions.flutter.commands()
              end,
              desc = "Commands",
            },
            ["<Leader>Fq"] = {
              function()
                require("flutter-tools.commands").quit()
              end,
              desc = "Quit",
            },
            ["<Leader>FR"] = {
              function()
                require("flutter-tools.commands").restart()
              end,
              desc = "Restart",
            },
            ["<Leader>Fr"] = {
              function()
                require("flutter-tools.commands").reload()
              end,
              desc = "Reload",
            },
            ["<Leader>Fd"] = {
              function()
                require("flutter-tools.devices").list_devices()
              end,
              desc = "List Devices",
            },
            ["<Leader>Fe"] = {
              function()
                require("flutter-tools.devices").list_emulators()
              end,
              desc = "List Emulators",
            },
            ["<Leader>Ft"] = {
              function()
                require("flutter-tools.commands").open_dev_tools()
              end,
              desc = "Open Dev Tools",
            },
            ["<Leader>Fg"] = {
              function()
                require("flutter-tools.commands").pub_get()
              end,
              desc = "PubGet",
            },
            ["<Leader>FD"] = {
              function()
                local handle = io.popen("dirname $(readlink $(which flutter))")
                if handle == nil then
                  print("Could not delete lock file, no handle to shell")
                  return
                end
                local output = handle:read("*a")
                local flutter_bin_path = output:gsub("[\n\r]", "") -- remove newlines
                local lock_file_path = flutter_bin_path .. "/cache/lockfile"

                handle:close()
                if output ~= nil and output ~= "" then
                  os.execute("rm  " .. lock_file_path)
                  -- print('rm  ' .. lock_file_path)
                end
              end,
              desc = "Delete Lock File",
            },
          },
        },
      },
    },
  },
}
