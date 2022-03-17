out = output

default: all


# -- HTML and other static stuff (just copy)

all: \
  $(out)/index.html \
  $(out)/jquery.min.js \
  $(out)/index.js \
  $(out)/netlify.toml

$(out)/index.html: index.html
	mkdir -p $(out)
	cp index.html $(out)/index.html

$(out)/index.js: index.js
	mkdir -p $(out)
	cp index.js $(out)/index.js

$(out)/jquery.min.js: jquery.min.js
	mkdir -p $(out)
	cp jquery.min.js $(out)/jquery.min.js

$(out)/netlify.toml: netlify.toml
	mkdir -p $(out)
	cp netlify.toml $(out)/netlify.toml


# -- CSS (convert via less)

STYLES_LESS := $(wildcard styles/*.less) $(wildcard styles/**/*.less)
STYLES_FONTS := $(wildcard styles/common-styles/fonts/*)

all: \
	$(out)/styles/fonts/*.ttf \
	$(out)/index.css

$(out)/styles/fonts/%.ttf: $(STYLES_FONTS)
	rm -rf $(out)/fonts
	mkdir -p $(out)/fonts
	cp styles/common-styles/fonts/*.ttf $(out)/fonts

$(out)/index.css: $(STYLES_LESS)
	mkdir -p $(out)/
	lessc \
		--verbose \
		--math=always \
		--source-map=$(out)/index.css.map \
		styles/index.less $(out)/index.css

# -- Images

all: \
	$(out)/logo.png \
	$(out)/favicon.png \
	$(out)/favicon.ico \
	$(out)/robots.txt

$(out)/logo.png: images/logo.png
	mkdir -p $(out)
	cp images/logo.png $(out)/logo.png

$(out)/favicon.png: images/nixos-logo-only-hires.png
	mkdir -p $(out)
	convert \
		-resize 16x16 \
		-background none \
		-gravity center \
		-extent 16x16 \
		images/nixos-logo-only-hires.png $(out)/favicon.png

$(out)/favicon.ico: $(out)/favicon.png
	mkdir -p $(out)
	convert \
		-resize x16 \
		-gravity center \
		-crop 16x16+0+0 \
		-flatten -colors 256 \
		-background transparent \
		$(out)/favicon.png $(out)/favicon.ico

$(out)/robots.txt: $(HTML)
	mkdir -p $(out)
	echo "User-agent: *" > $(out)/robots.txt
