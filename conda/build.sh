#!/bin/bash
# build.sh - noarch package: the plugin is plain JavaScript

set -ex

mkdir -p $PREFIX

cp customhud.mjs $PREFIX/
cp customhud.pplugin $PREFIX/

chmod 644 $PREFIX/customhud.mjs
chmod 644 $PREFIX/customhud.pplugin
