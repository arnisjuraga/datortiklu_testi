



pull: 
	git pull ; 
	$(MAKE) restart

restart:
	docker-compose down ; 

	DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker-compose up -d --build


