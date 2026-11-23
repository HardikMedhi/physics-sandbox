# Build the three living documents into docs/build/.
DOCS := physics math code
PDFS := $(addprefix build/,$(addsuffix .pdf,$(DOCS)))

all: $(PDFS)

build/%.pdf: %.tex preamble.tex references.bib
	latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=build $<

clean:
	latexmk -C -outdir=build
	rm -rf build

.PHONY: all clean
