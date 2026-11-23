# Build the three living documents into docs/build/.
# `make publish` also copies them to public/docs/ so the web app serves them
# (Vite copies public/ into dist/, so they are deployed with the site).
DOCS := physics math code
PDFS := $(addprefix build/,$(addsuffix .pdf,$(DOCS)))
PUBLISH_DIR := ../public/docs

all: $(PDFS)

build/%.pdf: %.tex preamble.tex references.bib
	latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=build $<

publish: all
	mkdir -p $(PUBLISH_DIR)
	cp $(PDFS) $(PUBLISH_DIR)/

clean:
	latexmk -C -outdir=build
	rm -rf build

.PHONY: all publish clean
