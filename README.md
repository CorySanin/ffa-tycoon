# ffa-tycoon

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/CorySanin/ffa-tycoon/docker-image.yml)](https://github.com/CorySanin/ffa-tycoon/actions/workflows/docker-image.yml)
[![Depfu](https://img.shields.io/depfu/dependencies/github/CorySanin/ffa-tycoon)](/package.json)
[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/corysanin/ffa-tycoon/latest)](https://hub.docker.com/r/corysanin/ffa-tycoon)
[![License](https://img.shields.io/github/license/CorySanin/ffa-tycoon)](/LICENSE)
[![Uptime Robot ratio (30 days)](https://img.shields.io/uptimerobot/ratio/m788089905-b569a9e9814f03cf016513d1)](https://status.ffa-tycoon.com/)
[![Discord](https://img.shields.io/discord/225989349949308928?label=Discord)](https://ffa-tycoon.com/discord)

Website for browsing and managing multiple OpenRCT2 servers

## Setup

As currently written, this project pretty much needs to exist in Docker. TODO: make work outside of Docker.

First and foremost, each server will need the [remote control](https://github.com/CorySanin/openrct2-remote-control) plugin. Follow the instruction in the [readme](https://github.com/CorySanin/openrct2-remote-control#docker-setup).

If you want screenshots with archived parks, you'll also need [rct-screenshotter](https://github.com/CorySanin/rct-screenshotter).

The [config file](config/config.json5) is fairly self-explanatory. The `privateport` should not be publically accessible as it allows for control over the servers. `screenshotter` can be set to `null` to disable screenshots.

The `servers` property is an array of parks, each with the following properties:
| Property | Description |
|---|---|
| `name` | The name to display on the site and to use in filenames of archived parks |
| `group` | Put servers into groups so that actions can be performed on all servers in a particular group |
| `gamemode` | A description of what mode the server is running in |
| `hostname` | The hostname of the OpenRCT2 server |
| `dir` | Location of this server's config OpenRCT2 directory |

Consider examining the example [config file](config/config.json5) and [docker-compose](docker-compose.yml).